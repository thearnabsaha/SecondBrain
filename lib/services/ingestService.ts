import { extractFromNote } from "../llm/extract";
import { generateBullets, generateSummary } from "../llm/summarize";
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

    const input = {
      person,
      attributes,
      relationships,
      recentNotes: notes,
    };
    // Two independent LLM calls in parallel. Use allSettled so a flaky
    // bullets call doesn't block the prose summary (or vice versa) — the
    // user always sees *something* on the profile page.
    const [proseRes, bulletsRes] = await Promise.allSettled([
      generateSummary(input),
      generateBullets(input),
    ]);

    if (proseRes.status === "rejected") {
      console.warn(
        `[summary] prose failed for person ${personId}: ${proseRes.reason?.message ?? proseRes.reason}`,
      );
      // Bullets without prose isn't a useful state — leave the existing
      // summary alone so the user keeps the previous (working) view.
      return;
    }

    let bulletsText: string | null = null;
    if (bulletsRes.status === "fulfilled") {
      // Empty array is a valid evidence-only outcome ("we have no
      // qualifying facts"). Store NULL in that case so the UI shows a
      // clean empty state instead of an empty string.
      bulletsText =
        bulletsRes.value.length > 0 ? bulletsRes.value.join("\n") : null;
    } else {
      console.warn(
        `[summary] bullets failed for person ${personId}: ${bulletsRes.reason?.message ?? bulletsRes.reason}`,
      );
    }

    await setSummary(userId, personId, {
      content: proseRes.value.trim(),
      bullets: bulletsText,
    });
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

  // Two distinct network calls: one to Neon (listPeople), one to Groq
  // (extractFromNote). Catching them in one try/catch made an earlier
  // version of this code blame Groq for transient Neon DNS failures —
  // the heuristic saw "ENOTFOUND" and incorrectly suggested setting
  // HTTPS_PROXY for api.groq.com. Now we know which one failed and can
  // give an accurate hint.
  let known: Awaited<ReturnType<typeof listPeople>>;
  try {
    known = await listPeople(userId);
  } catch (err) {
    const reason = (err as Error).message ?? String(err);
    console.warn(
      `[ingest] DB unreachable while loading known people for note ${note.id}: ${reason}`,
    );
    return {
      note_id: note.id,
      people: [],
      relationships_added: 0,
      relationships_reinforced: 0,
      pending: {
        reason,
        kind: "db_unreachable",
        suspectedNetworkBlock: false,
      },
    };
  }

  let payload: ExtractionPayload;
  try {
    payload = await extractFromNote(trimmed, known);
  } catch (err) {
    // Don't throw: the note IS saved, we just couldn't process it. Surface
    // a `pending` result so the UI can show "saved, retry needed" instead
    // of losing the user's input.
    const reason = (err as Error).message ?? String(err);
    // Only suspect a Groq-specific network block when the error pattern
    // really looks like one. The "All Groq models failed" prefix is added
    // by chat() exclusively, so any DNS / fetch error inside this block
    // is unambiguously about reaching api.groq.com (or its mirror).
    const suspectedNetworkBlock =
      /All Groq models failed/i.test(reason) &&
      /Connection error|fetch failed|ENOTFOUND|EAI_AGAIN|urlblock|blockpage|policy|denied|captive/i.test(
        reason,
      );
    console.warn(
      `[ingest] LLM extraction failed for note ${note.id}; saving as pending. Reason:\n${reason}`,
    );
    return {
      note_id: note.id,
      people: [],
      relationships_added: 0,
      relationships_reinforced: 0,
      pending: {
        reason,
        kind: "llm_failed",
        suspectedNetworkBlock,
      },
    };
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

  // The resolve cache is keyed by the raw name string the LLM emitted, so
  // multiple aliases for the same person ("Aarav", "aarav", "Aarav Sharma")
  // produce multiple cache entries pointing at the same DB row. Collapse by
  // person.id before returning so the UI sees each person exactly once.
  const peopleById = new Map<
    string,
    { id: string; name: string; is_new: boolean; attributes_added: number }
  >();
  for (const r of cache.values()) {
    const existing = peopleById.get(r.person.id);
    if (existing) {
      existing.attributes_added += r.attributesAdded;
      existing.is_new = existing.is_new || r.isNew;
    } else {
      peopleById.set(r.person.id, {
        id: r.person.id,
        name: r.person.name,
        is_new: r.isNew,
        attributes_added: r.attributesAdded,
      });
    }
  }

  return {
    note_id: note.id,
    people: Array.from(peopleById.values()),
    relationships_added: relationshipsAdded,
    relationships_reinforced: relationshipsReinforced,
  };
}
