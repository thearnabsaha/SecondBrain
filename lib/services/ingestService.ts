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
  userId: string,
  name: string,
  cache: Map<string, ResolvedPerson>,
): Promise<ResolvedPerson> {
  const cached = cache.get(name);
  if (cached) return cached;

  const existing = await findPersonByName(userId, name);
  if (existing) {
    const entry: ResolvedPerson = {
      person: existing,
      isNew: false,
      attributesAdded: 0,
    };
    cache.set(name, entry);
    return entry;
  }

  const created = await createPerson(userId, name);
  const entry: ResolvedPerson = {
    person: created,
    isNew: true,
    attributesAdded: 0,
  };
  cache.set(name, entry);
  return entry;
}

async function refreshSummary(
  userId: string,
  personId: string,
): Promise<void> {
  try {
    const person = await getPersonById(userId, personId);
    if (!person) return;
    const attributes = await getActiveAttributes(userId, personId);
    const rels = await getRelationshipsForPerson(userId, personId);
    const notes = await getNotesForPerson(userId, personId, 10);

    const relationships = await Promise.all(
      rels.map(async (rel) => {
        const otherId =
          rel.from_person_id === personId
            ? rel.to_person_id
            : rel.from_person_id;
        const direction = rel.from_person_id === personId ? "out" : "in";
        const other = await getPersonById(userId, otherId);
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
    await setSummary(userId, personId, summary.trim());
  } catch (err) {
    console.warn(
      `[summary] failed to regenerate for person ${personId}:`,
      (err as Error).message,
    );
  }
}

export async function ingestNote(
  userId: string,
  content: string,
): Promise<IngestResult> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Note content is empty.");

  const note = await createNote(userId, trimmed);

  let payload: ExtractionPayload;
  try {
    const known = await listPeople(userId);
    payload = await extractFromNote(trimmed, known);
  } catch (err) {
    throw new Error(
      `Extraction failed: ${(err as Error).message}. The note was saved but not processed.`,
    );
  }

  const cache = new Map<string, ResolvedPerson>();
  const affected = new Set<string>();

  for (const ep of payload.people) {
    const resolved = await resolvePerson(userId, ep.name, cache);
    affected.add(resolved.person.id);
    await addMention(userId, note.id, resolved.person.id, ep.name);

    for (const alias of ep.aliases ?? []) {
      if (alias && alias !== resolved.person.name) {
        await addAlias(userId, resolved.person.id, alias);
      }
    }

    for (const attr of ep.attributes) {
      const result = await upsertAttribute({
        userId,
        personId: resolved.person.id,
        category: attr.category,
        key: attr.key,
        value: attr.value,
        confidence: attr.confidence,
        sourceNoteId: note.id,
      });
      if (result.added) resolved.attributesAdded++;
    }
    await touchPerson(userId, resolved.person.id);
  }

  let relationshipsAdded = 0;
  let relationshipsReinforced = 0;
  for (const rel of payload.relationships) {
    const from = await resolvePerson(userId, rel.from, cache);
    const to = await resolvePerson(userId, rel.to, cache);
    affected.add(from.person.id);
    affected.add(to.person.id);

    const result = await upsertRelationship({
      userId,
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

  await Promise.all(
    Array.from(affected).map((pid) => refreshSummary(userId, pid)),
  );

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
