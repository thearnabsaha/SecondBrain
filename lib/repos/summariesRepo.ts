import { sql } from "../db/index";
import type { Summary } from "../types";

export async function getSummary(personId: string): Promise<Summary | undefined> {
  const rows = (await sql`
    SELECT * FROM summaries WHERE person_id = ${personId}
  `) as Summary[];
  return rows[0];
}

export async function setSummary(
  personId: string,
  content: string,
): Promise<void> {
  await sql`
    INSERT INTO summaries (person_id, content, generated_at)
    VALUES (${personId}, ${content}, NOW())
    ON CONFLICT (person_id) DO UPDATE
      SET content      = EXCLUDED.content,
          generated_at = EXCLUDED.generated_at
  `;
}

export async function deleteSummary(personId: string): Promise<void> {
  await sql`DELETE FROM summaries WHERE person_id = ${personId}`;
}
