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
  await sql`
    INSERT INTO note_mentions (id, user_id, note_id, person_id, mention_text)
    VALUES (${nanoid(12)}, ${userId}, ${noteId}, ${personId}, ${mentionText})
  `;
}

export async function getNotesForPerson(
  userId: string,
  personId: string,
  limit = 50,
): Promise<Note[]> {
  return (await sql`
    SELECT n.* FROM notes n
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
