import { nanoid } from "nanoid";
import { sql } from "../db/index";
import { normalizeName, namesMatch } from "../utils/names";
import type { Person } from "../types";

export async function listPeople(): Promise<Person[]> {
  const rows = (await sql`
    SELECT * FROM people ORDER BY updated_at DESC
  `) as Person[];
  return rows;
}

export async function getPersonById(id: string): Promise<Person | undefined> {
  const rows = (await sql`SELECT * FROM people WHERE id = ${id}`) as Person[];
  return rows[0];
}

/**
 * Fuzzy entity resolution.
 * 1. Exact match on normalized name.
 * 2. Exact match on a known alias.
 * 3. Fuzzy match against all people / aliases (personal-scale dataset).
 */
export async function findPersonByName(
  name: string,
): Promise<Person | undefined> {
  const normalized = normalizeName(name);
  if (!normalized) return undefined;

  const direct = (await sql`
    SELECT * FROM people WHERE normalized_name = ${normalized} LIMIT 1
  `) as Person[];
  if (direct[0]) return direct[0];

  const aliasHit = (await sql`
    SELECT p.* FROM people p
      JOIN person_aliases a ON a.person_id = p.id
      WHERE a.normalized_alias = ${normalized}
      LIMIT 1
  `) as Person[];
  if (aliasHit[0]) return aliasHit[0];

  const all = await listPeople();
  for (const p of all) {
    if (namesMatch(name, p.name)) return p;
  }

  const aliases = (await sql`
    SELECT p.*, a.alias FROM people p
      JOIN person_aliases a ON a.person_id = p.id
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

export async function createPerson(name: string): Promise<Person> {
  const id = nanoid(12);
  const normalized = normalizeName(name);
  await sql`
    INSERT INTO people (id, name, normalized_name)
    VALUES (${id}, ${name}, ${normalized})
  `;
  return (await getPersonById(id))!;
}

export async function touchPerson(id: string): Promise<void> {
  await sql`UPDATE people SET updated_at = NOW() WHERE id = ${id}`;
}

export async function renamePerson(id: string, newName: string): Promise<void> {
  await sql`
    UPDATE people
       SET name = ${newName},
           normalized_name = ${normalizeName(newName)},
           updated_at = NOW()
     WHERE id = ${id}
  `;
}

export async function addAlias(
  personId: string,
  alias: string,
): Promise<void> {
  const normalized = normalizeName(alias);
  if (!normalized) return;
  const existing = (await sql`
    SELECT 1 FROM person_aliases
     WHERE person_id = ${personId} AND normalized_alias = ${normalized}
  `) as Array<{ "?column?": number }>;
  if (existing[0]) return;
  await sql`
    INSERT INTO person_aliases (id, person_id, alias, normalized_alias)
    VALUES (${nanoid(12)}, ${personId}, ${alias}, ${normalized})
  `;
}

export async function getAliases(personId: string): Promise<string[]> {
  const rows = (await sql`
    SELECT alias FROM person_aliases WHERE person_id = ${personId}
  `) as Array<{ alias: string }>;
  return rows.map((r) => r.alias);
}

export async function deletePerson(id: string): Promise<void> {
  await sql`DELETE FROM people WHERE id = ${id}`;
}
