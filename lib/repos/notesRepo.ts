import { nanoid } from "nanoid";
import { sql } from "../db/index";
import type { Note, NoteMention } from "../types";

export async function createNote(
  userId: string,
  content: string,
): Promise<Note> {
  const id = nanoid(12);
  await sql`
    INSERT INTO notes (id, user_id, content) VALUES (${id}, ${userId}, ${content})
  `;
  const rows = (await sql`
    SELECT * FROM notes WHERE id = ${id} AND user_id = ${userId}
  `) as Note[];
  return rows[0];
}

export async function listNotes(userId: string, limit = 100): Promise<Note[]> {
  return (await sql`
    SELECT * FROM notes
     WHERE user_id = ${userId}
     ORDER BY created_at DESC
     LIMIT ${limit}
  `) as Note[];
}

export async function getNoteById(
  userId: string,
  id: string,
): Promise<Note | undefined> {
  const rows = (await sql`
    SELECT * FROM notes WHERE id = ${id} AND user_id = ${userId}
  `) as Note[];
  return rows[0];
}

export async function addMention(
  userId: string,
  noteId: string,
  personId: string,
  mentionText: string | null,
): Promise<void> {
  // Idempotent: a single (note, person) mention pair is unique. Without
  // ON CONFLICT, ingesting a note where the LLM resolves "Aarav" + "Aarav
  // Sharma" to the same person id would insert two mention rows and break
  // the timeline. The unique index `idx_note_mentions_unique` enforces this
  // at the DB layer; here we just no-op on conflict.
  await sql`
    INSERT INTO note_mentions (id, user_id, note_id, person_id, mention_text)
    VALUES (${nanoid(12)}, ${userId}, ${noteId}, ${personId}, ${mentionText})
    ON CONFLICT (note_id, person_id) DO NOTHING
  `;
}

export async function getNotesForPerson(
  userId: string,
  personId: string,
  limit = 50,
): Promise<Note[]> {
  // SELECT DISTINCT: a single note can be mentioned twice for the same
  // person (when an LLM-extracted note resolves multiple name variants —
  // "Aarav" + "Aarav Sharma" — to the same DB row, addMention is called for
  // each variant). Without DISTINCT the join multiplies the note row,
  // producing duplicate React keys on the timeline.
  return (await sql`
    SELECT DISTINCT n.id, n.user_id, n.content, n.created_at
      FROM notes n
      JOIN note_mentions m ON m.note_id = n.id
     WHERE n.user_id = ${userId} AND m.person_id = ${personId}
     ORDER BY n.created_at DESC
     LIMIT ${limit}
  `) as Note[];
}

export async function getMentionsForNote(
  userId: string,
  noteId: string,
): Promise<NoteMention[]> {
  return (await sql`
    SELECT * FROM note_mentions
     WHERE note_id = ${noteId} AND user_id = ${userId}
  `) as NoteMention[];
}

/**
 * Batched mentions lookup for N notes in one round-trip. Returns a
 * Map<noteId, NoteMention[]>. Used by search to avoid one query per hit.
 */
export async function getMentionsForNotes(
  userId: string,
  noteIds: readonly string[],
): Promise<Map<string, NoteMention[]>> {
  const out = new Map<string, NoteMention[]>();
  if (noteIds.length === 0) return out;
  const unique = Array.from(new Set(noteIds));
  const rows = (await sql`
    SELECT * FROM note_mentions
     WHERE user_id = ${userId}
       AND note_id = ANY(${unique})
  `) as NoteMention[];
  for (const m of rows) {
    const list = out.get(m.note_id);
    if (list) list.push(m);
    else out.set(m.note_id, [m]);
  }
  return out;
}

export async function searchNotes(
  userId: string,
  query: string,
): Promise<Note[]> {
  const like = `%${query.toLowerCase()}%`;
  return (await sql`
    SELECT * FROM notes
     WHERE user_id = ${userId} AND LOWER(content) LIKE ${like}
     ORDER BY created_at DESC
     LIMIT 100
  `) as Note[];
}
