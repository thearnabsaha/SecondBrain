import { nanoid } from "nanoid";
import { sql } from "../db/index";
import type { User } from "../types";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function findUserByEmail(
  email: string,
): Promise<{ user: User; password_hash: string } | null> {
  const rows = (await sql`
    SELECT id, email, password_hash, name, created_at, updated_at
    FROM users
    WHERE email = ${email.toLowerCase()}
    LIMIT 1
  `) as UserRow[];
  if (rows.length === 0) return null;
  const r = rows[0];
  return { user: rowToUser(r), password_hash: r.password_hash };
}

export async function findUserById(id: string): Promise<User | null> {
  const rows = (await sql`
    SELECT id, email, password_hash, name, created_at, updated_at
    FROM users
    WHERE id = ${id}
    LIMIT 1
  `) as UserRow[];
  if (rows.length === 0) return null;
  return rowToUser(rows[0]);
}

export async function createUser(
  email: string,
  passwordHash: string,
  name: string | null,
): Promise<User> {
  const id = nanoid();
  const rows = (await sql`
    INSERT INTO users (id, email, password_hash, name)
    VALUES (${id}, ${email.toLowerCase()}, ${passwordHash}, ${name})
    RETURNING id, email, password_hash, name, created_at, updated_at
  `) as UserRow[];
  return rowToUser(rows[0]);
}

export async function updateUserProfile(
  id: string,
  patch: { name?: string | null; email?: string },
): Promise<User | null> {
  // Only update fields actually provided. Two separate UPDATEs is simpler
  // than building a dynamic SQL string here.
  if (patch.email !== undefined) {
    await sql`
      UPDATE users
         SET email = ${patch.email.toLowerCase()},
             updated_at = NOW()
       WHERE id = ${id}
    `;
  }
  if (patch.name !== undefined) {
    await sql`
      UPDATE users
         SET name = ${patch.name},
             updated_at = NOW()
       WHERE id = ${id}
    `;
  }
  return findUserById(id);
}

export async function updateUserPassword(
  id: string,
  passwordHash: string,
): Promise<void> {
  await sql`
    UPDATE users
       SET password_hash = ${passwordHash},
           updated_at = NOW()
     WHERE id = ${id}
  `;
}

export async function getPasswordHash(id: string): Promise<string | null> {
  const rows = (await sql`
    SELECT password_hash FROM users WHERE id = ${id} LIMIT 1
  `) as Array<{ password_hash: string }>;
  return rows[0]?.password_hash ?? null;
}

/**
 * Wipes all the user's graph data but keeps the account row itself.
 * Each FK has ON DELETE CASCADE on user_id, but we want to keep the user
 * row, so delete the dependent tables explicitly. Order doesn't strictly
 * matter (FK cascades handle children) but we mirror it for safety.
 *
 * `summaries` is gone via people CASCADE; `note_mentions` via notes/people
 * CASCADE; `attributes` and `relationships` via people CASCADE; aliases
 * via people CASCADE. Notes are deleted directly.
 */
export async function wipeUserGraph(userId: string): Promise<void> {
  await sql`DELETE FROM people WHERE user_id = ${userId}`;
  await sql`DELETE FROM notes  WHERE user_id = ${userId}`;
}

/**
 * Hard-delete the user. All owned tables cascade.
 */
export async function deleteUser(userId: string): Promise<void> {
  await sql`DELETE FROM users WHERE id = ${userId}`;
}
