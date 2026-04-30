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

  const direct = await findPersonByName(userId, q);
  if (direct) bump(direct, `name match: ${direct.name}`, 10);

  const all = await listPeople(userId);
  for (const p of all) {
    if (p.id === direct?.id) continue;
    if (namesMatch(q, p.name)) bump(p, `name match: ${p.name}`, 6);
  }

  const attrHits = await searchAttributes(userId, q);
  for (const a of attrHits) {
    const p = await getPersonById(userId, a.person_id);
    if (!p) continue;
    bump(
      p,
      `${a.category}/${a.key}: ${a.value}`,
      Math.max(2, Math.round(a.confidence * 5)),
    );
  }

  const noteHits = await searchNotes(userId, q);
  for (const n of noteHits) {
    const mentions = await getMentionsForNote(userId, n.id);
    for (const m of mentions) {
      const p = await getPersonById(userId, m.person_id);
      if (p) bump(p, `mentioned in note: "${truncate(n.content, 60)}"`, 1);
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
