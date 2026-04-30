import { nanoid } from "nanoid";
import { sql } from "../db/index";
import { normalizeName, namesMatch } from "../utils/names";
import type { Person } from "../types";

export async function listPeople(userId: string): Promise<Person[]> {
  const rows = (await sql`
    SELECT * FROM people
     WHERE user_id = ${userId}
     ORDER BY updated_at DESC
  `) as Person[];
  return rows;
}

export async function getPersonById(
  userId: string,
  id: string,
): Promise<Person | undefined> {
  const rows = (await sql`
    SELECT * FROM people
     WHERE id = ${id} AND user_id = ${userId}
  `) as Person[];
  return rows[0];
}

/**
 * Batch counterpart of getPersonById. One round-trip for N ids.
 * Caller-friendly: returns a Map<id, Person> so lookups are O(1) and missing
 * ids are simply absent from the map.
 */
export async function getPeopleByIds(
  userId: string,
  ids: readonly string[],
): Promise<Map<string, Person>> {
  const out = new Map<string, Person>();
  if (ids.length === 0) return out;
  // De-dupe: callers commonly pass the same id multiple times.
  const unique = Array.from(new Set(ids));
  const rows = (await sql`
    SELECT * FROM people
     WHERE user_id = ${userId}
       AND id = ANY(${unique})
  `) as Person[];
  for (const p of rows) out.set(p.id, p);
  return out;
}

/**
 * Cheap, one-query alias lookup: returns the person that has an alias
 * exactly matching the (already-normalized) query string. Used by the
 * search service hot path where we already have all people loaded in JS
 * for the name match and only need a single round-trip for aliases.
 */
export async function findPersonByAlias(
  userId: string,
  normalizedAlias: string,
): Promise<Person | undefined> {
  if (!normalizedAlias) return undefined;
  const rows = (await sql`
    SELECT p.* FROM people p
      JOIN person_aliases a ON a.person_id = p.id
     WHERE p.user_id = ${userId} AND a.normalized_alias = ${normalizedAlias}
     LIMIT 1
  `) as Person[];
  return rows[0];
}

/**
 * Fuzzy entity resolution within the user's own people only.
 *   1. Exact match on normalized name.
 *   2. Exact match on a known alias.
 *   3. Fuzzy match across all people / aliases (personal-scale dataset).
 */
export async function findPersonByName(
  userId: string,
  name: string,
): Promise<Person | undefined> {
  const normalized = normalizeName(name);
  if (!normalized) return undefined;

  const direct = (await sql`
    SELECT * FROM people
     WHERE user_id = ${userId} AND normalized_name = ${normalized}
     LIMIT 1
  `) as Person[];
  if (direct[0]) return direct[0];

  const aliasHit = (await sql`
    SELECT p.* FROM people p
      JOIN person_aliases a ON a.person_id = p.id
      WHERE p.user_id = ${userId} AND a.normalized_alias = ${normalized}
      LIMIT 1
  `) as Person[];
  if (aliasHit[0]) return aliasHit[0];

  const all = await listPeople(userId);
  for (const p of all) {
    if (namesMatch(name, p.name)) return p;
  }

  const aliases = (await sql`
    SELECT p.*, a.alias FROM people p
      JOIN person_aliases a ON a.person_id = p.id
      WHERE p.user_id = ${userId}
  `) as Array<Person & { alias: string }>;
  for (const row of aliases) {
    if (namesMatch(name, row.alias)) {
      const { alias: _alias, ...person } = row;
      void _alias;
      return person as Person;
    }
  }
  return undefined;
}

export async function createPerson(
  userId: string,
  name: string,
): Promise<Person> {
  const id = nanoid(12);
  const normalized = normalizeName(name);
  await sql`
    INSERT INTO people (id, user_id, name, normalized_name)
    VALUES (${id}, ${userId}, ${name}, ${normalized})
  `;
  return (await getPersonById(userId, id))!;
}

export async function touchPerson(userId: string, id: string): Promise<void> {
  await sql`
    UPDATE people SET updated_at = NOW()
     WHERE id = ${id} AND user_id = ${userId}
  `;
}

export async function renamePerson(
  userId: string,
  id: string,
  newName: string,
): Promise<void> {
  await sql`
    UPDATE people
       SET name = ${newName},
           normalized_name = ${normalizeName(newName)},
           updated_at = NOW()
     WHERE id = ${id} AND user_id = ${userId}
  `;
}

export async function addAlias(
  userId: string,
  personId: string,
  alias: string,
): Promise<void> {
  const normalized = normalizeName(alias);
  if (!normalized) return;
  const existing = (await sql`
    SELECT 1 FROM person_aliases
     WHERE user_id = ${userId}
       AND person_id = ${personId}
       AND normalized_alias = ${normalized}
  `) as Array<{ "?column?": number }>;
  if (existing[0]) return;
  await sql`
    INSERT INTO person_aliases (id, user_id, person_id, alias, normalized_alias)
    VALUES (${nanoid(12)}, ${userId}, ${personId}, ${alias}, ${normalized})
  `;
}

export async function getAliases(
  userId: string,
  personId: string,
): Promise<string[]> {
  const rows = (await sql`
    SELECT alias FROM person_aliases
     WHERE user_id = ${userId} AND person_id = ${personId}
  `) as Array<{ alias: string }>;
  return rows.map((r) => r.alias);
}

export async function deletePerson(userId: string, id: string): Promise<void> {
  await sql`DELETE FROM people WHERE id = ${id} AND user_id = ${userId}`;
}
