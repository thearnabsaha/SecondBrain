import {
  getActiveAttributes,
  searchAttributes,
} from "../repos/attributesRepo";
import {
  findPersonByAlias,
  getPersonById,
  listPeople,
} from "../repos/peopleRepo";
import {
  getMentionsForNotes,
  searchNotes,
} from "../repos/notesRepo";
import { namesMatch, normalizeName } from "../utils/names";
import type { Person } from "../types";

export interface PersonSearchHit {
  person: Person;
  reasons: string[];
  score: number;
}

export async function searchPeople(
  userId: string,
  query: string,
): Promise<PersonSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const hits = new Map<string, PersonSearchHit>();
  const bump = (person: Person, reason: string, weight: number) => {
    const existing = hits.get(person.id);
    if (existing) {
      existing.score += weight;
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
    } else {
      hits.set(person.id, { person, reasons: [reason], score: weight });
    }
  };

  // Fan out independent SQL queries in parallel. The previous version
  // called findPersonByName here, which does up to 4 sequential round-trips
  // when the query doesn't match a known person — that dominated wall-clock
  // for non-name searches like "doctor". Now we do exact name match in JS
  // (listPeople is already loaded) and only the alias lookup hits the DB.
  const normalized = normalizeName(q);
  const [all, attrHits, noteHits, aliasHit] = await Promise.all([
    listPeople(userId),
    searchAttributes(userId, q),
    searchNotes(userId, q),
    findPersonByAlias(userId, normalized),
  ]);

  // Build one Map<personId, Person> from the already-fetched listPeople so
  // we never round-trip back to the DB for a per-person lookup.
  const peopleById = new Map<string, Person>();
  for (const p of all) peopleById.set(p.id, p);

  // Local name resolution: exact normalized match wins (weight 10), then
  // alias hit, then fuzzy matches get weight 6. Mirrors findPersonByName at
  // near-zero DB cost.
  let direct: Person | undefined;
  if (normalized) {
    direct = all.find((p) => p.normalized_name === normalized);
    if (direct) bump(direct, `name match: ${direct.name}`, 10);
  }
  if (!direct && aliasHit) {
    direct = aliasHit;
    bump(aliasHit, `alias match: ${aliasHit.name}`, 9);
  }
  for (const p of all) {
    if (p.id === direct?.id) continue;
    if (namesMatch(q, p.name)) bump(p, `name match: ${p.name}`, 6);
  }

  for (const a of attrHits) {
    const p = peopleById.get(a.person_id);
    if (!p) continue;
    bump(
      p,
      `${a.category}/${a.key}: ${a.value}`,
      Math.max(2, Math.round(a.confidence * 5)),
    );
  }

  // Note mentions: one batched query for all matched notes, then look the
  // mentioned people up locally. Fixes a 2D N+1 (per note, per mention).
  if (noteHits.length > 0) {
    const mentionsByNote = await getMentionsForNotes(
      userId,
      noteHits.map((n) => n.id),
    );
    for (const n of noteHits) {
      const mentions = mentionsByNote.get(n.id) ?? [];
      for (const m of mentions) {
        const p = peopleById.get(m.person_id);
        if (p) bump(p, `mentioned in note: "${truncate(n.content, 60)}"`, 1);
      }
    }
  }

  return Array.from(hits.values()).sort((a, b) => b.score - a.score);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export async function getPersonProfile(userId: string, personId: string) {
  const person = await getPersonById(userId, personId);
  if (!person) return null;
  const attributes = await getActiveAttributes(userId, personId);
  return { person, attributes };
}
