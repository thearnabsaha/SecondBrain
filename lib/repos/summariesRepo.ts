import { sql } from "../db/index";
import type { Summary } from "../types";

export async function getSummary(
  userId: string,
  personId: string,
): Promise<Summary | undefined> {
  const rows = (await sql`
    SELECT person_id, user_id, content, bullets, generated_at
      FROM summaries
     WHERE person_id = ${personId} AND user_id = ${userId}
  `) as Summary[];
  return rows[0];
}

/**
 * Upserts the prose summary and (optionally) the bulleted version. Pass
 * `bullets: null` to explicitly clear an old bulleted version; omit it to
 * leave whatever's already stored in place.
 *
 * Two distinct SQL statements (instead of one with COALESCE) so that
 * "leave alone" and "clear to NULL" don't have to be encoded as a sentinel.
 */
export async function setSummary(
  userId: string,
  personId: string,
  payload: { content: string; bullets?: string | null },
): Promise<void> {
  const { content, bullets } = payload;
  if (bullets === undefined) {
    await sql`
      INSERT INTO summaries (person_id, user_id, content, generated_at)
      VALUES (${personId}, ${userId}, ${content}, NOW())
      ON CONFLICT (person_id) DO UPDATE
        SET content      = EXCLUDED.content,
            generated_at = EXCLUDED.generated_at
    `;
  } else {
    await sql`
      INSERT INTO summaries (person_id, user_id, content, bullets, generated_at)
      VALUES (${personId}, ${userId}, ${content}, ${bullets}, NOW())
      ON CONFLICT (person_id) DO UPDATE
        SET content      = EXCLUDED.content,
            bullets      = EXCLUDED.bullets,
            generated_at = EXCLUDED.generated_at
    `;
  }
}

export async function deleteSummary(
  userId: string,
  personId: string,
): Promise<void> {
  await sql`
    DELETE FROM summaries WHERE person_id = ${personId} AND user_id = ${userId}
  `;
}
