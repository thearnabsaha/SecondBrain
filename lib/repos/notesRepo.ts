import { nanoid } from "nanoid";
import { sql } from "../db/index";
import type { Note, NoteMention } from "../types";

export async function createNote(content: string): Promise<Note> {
  const id = nanoid(12);
  await sql`INSERT INTO notes (id, content) VALUES (${id}, ${content})`;
  const rows = (await sql`SELECT * FROM notes WHERE id = ${id}`) as Note[];
  return rows[0];
}

export async function listNotes(limit = 100): Promise<Note[]> {
  return (await sql`
    SELECT * FROM notes ORDER BY created_at DESC LIMIT ${limit}
  `) as Note[];
}

export async function getNoteById(id: string): Promise<Note | undefined> {
  const rows = (await sql`SELECT * FROM notes WHERE id = ${id}`) as Note[];
  return rows[0];
}

export async function addMention(
  noteId: string,
  personId: string,
  mentionText: string | null,
): Promise<void> {
  await sql`
    INSERT INTO note_mentions (id, note_id, person_id, mention_text)
    VALUES (${nanoid(12)}, ${noteId}, ${personId}, ${mentionText})
  `;
}

export async function getNotesForPerson(
  personId: string,
  limit = 50,
): Promise<Note[]> {
  return (await sql`
    SELECT n.* FROM notes n
      JOIN note_mentions m ON m.note_id = n.id
     WHERE m.person_id = ${personId}
     ORDER BY n.created_at DESC
     LIMIT ${limit}
  `) as Note[];
}

export async function getMentionsForNote(
  noteId: string,
): Promise<NoteMention[]> {
  return (await sql`
    SELECT * FROM note_mentions WHERE note_id = ${noteId}
  `) as NoteMention[];
}

export async function searchNotes(query: string): Promise<Note[]> {
  const like = `%${query.toLowerCase()}%`;
  return (await sql`
    SELECT * FROM notes
     WHERE LOWER(content) LIKE ${like}
     ORDER BY created_at DESC
     LIMIT 100
  `) as Note[];
}
