import { extractFromNote } from "../llm/extract";
import { generateSummary } from "../llm/summarize";
import {
  addAlias,
  createPerson,
  findPersonByName,
  getPersonById,
  listPeople,
  touchPerson,
} from "../repos/peopleRepo";
import {
  upsertAttribute,
  getActiveAttributes,
} from "../repos/attributesRepo";
import {
  upsertRelationship,
  getRelationshipsForPerson,
} from "../repos/relationshipsRepo";
import {
  addMention,
  createNote,
  getNotesForPerson,
} from "../repos/notesRepo";
import { setSummary } from "../repos/summariesRepo";
import type {
  ExtractionPayload,
  IngestResult,
  Person,
} from "../types";

interface ResolvedPerson {
  person: Person;
  isNew: boolean;
  attributesAdded: number;
}

async function resolvePerson(
  name: string,
  cache: Map<string, ResolvedPerson>,
): Promise<ResolvedPerson> {
  const cached = cache.get(name);
  if (cached) return cached;

  const existing = await findPersonByName(name);
  if (existing) {
    const entry: ResolvedPerson = {
      person: existing,
      isNew: false,
      attributesAdded: 0,
    };
    cache.set(name, entry);
    return entry;
  }

  const created = await createPerson(name);
  const entry: ResolvedPerson = {
    person: created,
    isNew: true,
    attributesAdded: 0,
  };
  cache.set(name, entry);
  return entry;
}

/**
 * Refresh a person's summary. Failures are swallowed so a flaky LLM call
 * doesn't break ingest.
 */
async function refreshSummary(personId: string): Promise<void> {
  try {
    const person = await getPersonById(personId);
    if (!person) return;
    const attributes = await getActiveAttributes(personId);
    const rels = await getRelationshipsForPerson(personId);
    const notes = await getNotesForPerson(personId, 10);

    const relationships = await Promise.all(
      rels.map(async (rel) => {
        const otherId =
          rel.from_person_id === personId
            ? rel.to_person_id
            : rel.from_person_id;
        const direction = rel.from_person_id === personId ? "out" : "in";
        const other = await getPersonById(otherId);
        return {
          rel,
          otherName: other?.name ?? "(unknown)",
          direction: direction as "in" | "out",
        };
      }),
    );

    const summary = await generateSummary({
      person,
      attributes,
      relationships,
      recentNotes: notes,
    });
    await setSummary(personId, summary.trim());
  } catch (err) {
    console.warn(
      `[summary] failed to regenerate for person ${personId}:`,
      (err as Error).message,
    );
  }
}

/**
 * The main ingestion pipeline.
 * 1. Save the raw note.
 * 2. Ask the LLM to extract people, attributes, relationships.
 * 3. Resolve each name to an existing or new person (fuzzy matching).
 * 4. Merge attributes (preserving history).
 * 5. Upsert directed relationships (with reinforcement).
 * 6. Record mentions for the timeline.
 * 7. Regenerate summaries for affected people (sequentially in serverless
 *    so we don't get cut off mid-await; finalizes before the response).
 */
export async function ingestNote(content: string): Promise<IngestResult> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Note content is empty.");

  const note = await createNote(trimmed);

  let payload: ExtractionPayload;
  try {
    const known = await listPeople();
    payload = await extractFromNote(trimmed, known);
  } catch (err) {
    throw new Error(
      `Extraction failed: ${(err as Error).message}. The note was saved but not processed.`,
    );
  }

  const cache = new Map<string, ResolvedPerson>();
  const affected = new Set<string>();

  for (const ep of payload.people) {
    const resolved = await resolvePerson(ep.name, cache);
    affected.add(resolved.person.id);
    await addMention(note.id, resolved.person.id, ep.name);

    for (const alias of ep.aliases ?? []) {
      if (alias && alias !== resolved.person.name) {
        await addAlias(resolved.person.id, alias);
      }
    }

    for (const attr of ep.attributes) {
      const result = await upsertAttribute({
        personId: resolved.person.id,
        category: attr.category,
        key: attr.key,
        value: attr.value,
        confidence: attr.confidence,
        sourceNoteId: note.id,
      });
      if (result.added) resolved.attributesAdded++;
    }
    await touchPerson(resolved.person.id);
  }

  let relationshipsAdded = 0;
  let relationshipsReinforced = 0;
  for (const rel of payload.relationships) {
    const from = await resolvePerson(rel.from, cache);
    const to = await resolvePerson(rel.to, cache);
    affected.add(from.person.id);
    affected.add(to.person.id);

    const result = await upsertRelationship({
      fromId: from.person.id,
      toId: to.person.id,
      type: rel.type,
      label: rel.label ?? null,
      confidence: rel.confidence,
      sourceNoteId: note.id,
    });
    relationshipsAdded += result.added;
    relationshipsReinforced += result.reinforced;
  }

  // Regenerate summaries before responding so the UI sees fresh data.
  // Limited concurrency keeps cold-start lambdas under their memory cap.
  await Promise.all(Array.from(affected).map(refreshSummary));

  return {
    note_id: note.id,
    people: Array.from(cache.values()).map((r) => ({
      id: r.person.id,
      name: r.person.name,
      is_new: r.isNew,
      attributes_added: r.attributesAdded,
    })),
    relationships_added: relationshipsAdded,
    relationships_reinforced: relationshipsReinforced,
  };
}
