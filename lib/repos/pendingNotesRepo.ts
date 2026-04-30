import { sql } from "../db/index";
import type { PendingNote, PendingNoteKind } from "../types";

/**
 * Repo for the `pending_notes` queue. A row exists exactly when a note
 * was saved but the LLM/DB pipeline couldn't fully process it. The Inbox
 * UI lists these so the user can retry or discard.
 */

export async function recordPending(
  userId: string,
  noteId: string,
  kind: PendingNoteKind,
  reason: string,
): Promise<void> {
  // ON CONFLICT for idempotency: if the same note fails again before it's
  // cleared, just bump attempts and refresh the reason instead of erroring.
  await sql`
    INSERT INTO pending_notes (note_id, user_id, kind, reason)
    VALUES (${noteId}, ${userId}, ${kind}, ${reason})
    ON CONFLICT (note_id) DO UPDATE
      SET kind     = EXCLUDED.kind,
          reason   = EXCLUDED.reason,
          attempts = pending_notes.attempts + 1
  `;
}

export async function clearPending(
  userId: string,
  noteId: string,
): Promise<void> {
  await sql`
    DELETE FROM pending_notes
     WHERE note_id = ${noteId} AND user_id = ${userId}
  `;
}

export async function markRetried(
  userId: string,
  noteId: string,
): Promise<void> {
  await sql`
    UPDATE pending_notes
       SET retried_at = NOW(),
           attempts   = attempts + 1
     WHERE note_id = ${noteId} AND user_id = ${userId}
  `;
}

/**
 * List of pending rows joined with the underlying note content so the
 * Inbox UI can render content+reason in a single fetch.
 */
export interface PendingNoteWithContent extends PendingNote {
  content: string;
  note_created_at: string;
}

export async function listPendingForUser(
  userId: string,
): Promise<PendingNoteWithContent[]> {
  return (await sql`
    SELECT p.note_id, p.user_id, p.kind, p.reason, p.attempts,
           p.created_at, p.retried_at,
           n.content, n.created_at AS note_created_at
      FROM pending_notes p
      JOIN notes n ON n.id = p.note_id
     WHERE p.user_id = ${userId}
     ORDER BY p.created_at DESC
  `) as PendingNoteWithContent[];
}

export async function countPendingForUser(userId: string): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n FROM pending_notes WHERE user_id = ${userId}
  `) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}
