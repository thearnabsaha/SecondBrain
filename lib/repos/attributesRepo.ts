import { nanoid } from "nanoid";
import { sql } from "../db/index";
import type { Attribute, AttributeCategory } from "../types";

export async function getAttributesForPerson(
  userId: string,
  personId: string,
): Promise<Attribute[]> {
  return (await sql`
    SELECT * FROM attributes
     WHERE user_id = ${userId} AND person_id = ${personId}
     ORDER BY (superseded_by IS NULL) DESC, updated_at DESC
  `) as Attribute[];
}

export async function getActiveAttributes(
  userId: string,
  personId: string,
): Promise<Attribute[]> {
  return (await sql`
    SELECT * FROM attributes
     WHERE user_id = ${userId}
       AND person_id = ${personId}
       AND superseded_by IS NULL
     ORDER BY updated_at DESC
  `) as Attribute[];
}

export interface UpsertAttributeInput {
  userId: string;
  personId: string;
  category: AttributeCategory;
  key: string;
  value: string;
  confidence: number;
  sourceNoteId: string | null;
}

export async function upsertAttribute(
  input: UpsertAttributeInput,
): Promise<{ added: boolean; attribute: Attribute }> {
  const sameRows = (await sql`
    SELECT * FROM attributes
     WHERE user_id   = ${input.userId}
       AND person_id = ${input.personId}
       AND category  = ${input.category}
       AND key       = ${input.key}
       AND value     = ${input.value}
       AND superseded_by IS NULL
     LIMIT 1
  `) as Attribute[];
  const existingSame = sameRows[0];
  if (existingSame) {
    const newConf = Math.max(existingSame.confidence, input.confidence);
    await sql`
      UPDATE attributes
         SET confidence = ${newConf},
             updated_at = NOW()
       WHERE id = ${existingSame.id}
    `;
    const refreshed = (await sql`
      SELECT * FROM attributes WHERE id = ${existingSame.id}
    `) as Attribute[];
    return { added: false, attribute: refreshed[0] };
  }

  const id = nanoid(12);

  const conflicting = (await sql`
    SELECT * FROM attributes
     WHERE user_id   = ${input.userId}
       AND person_id = ${input.personId}
       AND category  = ${input.category}
       AND key       = ${input.key}
       AND superseded_by IS NULL
  `) as Attribute[];

  await sql`
    INSERT INTO attributes
      (id, user_id, person_id, category, key, value, confidence, source_note_id)
    VALUES
      (${id}, ${input.userId}, ${input.personId}, ${input.category}, ${input.key},
       ${input.value}, ${input.confidence}, ${input.sourceNoteId})
  `;

  for (const old of conflicting) {
    await sql`UPDATE attributes SET superseded_by = ${id} WHERE id = ${old.id}`;
  }

  const created = (await sql`
    SELECT * FROM attributes WHERE id = ${id}
  `) as Attribute[];
  return { added: true, attribute: created[0] };
}

export async function searchAttributes(
  userId: string,
  query: string,
): Promise<Attribute[]> {
  const like = `%${query.toLowerCase()}%`;
  return (await sql`
    SELECT * FROM attributes
     WHERE user_id = ${userId}
       AND superseded_by IS NULL
       AND (LOWER(value) LIKE ${like} OR LOWER(key) LIKE ${like})
     ORDER BY confidence DESC, updated_at DESC
     LIMIT 200
  `) as Attribute[];
}

export async function deleteAttribute(
  userId: string,
  id: string,
): Promise<void> {
  await sql`DELETE FROM attributes WHERE id = ${id} AND user_id = ${userId}`;
}
