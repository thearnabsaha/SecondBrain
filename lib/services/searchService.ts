import {
  getActiveAttributes,
  searchAttributes,
} from "../repos/attributesRepo";
import {
  findPersonByName,
  getPersonById,
  listPeople,
} from "../repos/peopleRepo";
import {
  getMentionsForNote,
  searchNotes,
} from "../repos/notesRepo";
import { namesMatch } from "../utils/names";
import type { Person } from "../types";

export interface PersonSearchHit {
  person: Person;
  reasons: string[];
  score: number;
}

/**
 * Hybrid search across names, aliases, attributes, and notes.
 */
export async function searchPeople(query: string): Promise<PersonSearchHit[]> {
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

  const direct = await findPersonByName(q);
  if (direct) bump(direct, `name match: ${direct.name}`, 10);

  const all = await listPeople();
  for (const p of all) {
    if (p.id === direct?.id) continue;
    if (namesMatch(q, p.name)) bump(p, `name match: ${p.name}`, 6);
  }

  const attrHits = await searchAttributes(q);
  for (const a of attrHits) {
    const p = await getPersonById(a.person_id);
    if (!p) continue;
    bump(
      p,
      `${a.category}/${a.key}: ${a.value}`,
      Math.max(2, Math.round(a.confidence * 5)),
    );
  }

  const noteHits = await searchNotes(q);
  for (const n of noteHits) {
    const mentions = await getMentionsForNote(n.id);
    for (const m of mentions) {
      const p = await getPersonById(m.person_id);
      if (p) bump(p, `mentioned in note: "${truncate(n.content, 60)}"`, 1);
    }
  }

  return Array.from(hits.values()).sort((a, b) => b.score - a.score);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export async function getPersonProfile(personId: string) {
  const person = await getPersonById(personId);
  if (!person) return null;
  const attributes = await getActiveAttributes(personId);
  return { person, attributes };
}
