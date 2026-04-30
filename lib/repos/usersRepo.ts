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
