import { sql } from "./index";

/**
 * Idempotent schema migration. Safe to run on every cold start.
 *
 * All user-owned tables carry a `user_id` and cascade-delete with the user.
 */
export async function applySchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS people (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_people_user ON people(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_people_user_normalized ON people(user_id, normalized_name)`;

  await sql`
    CREATE TABLE IF NOT EXISTS person_aliases (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      person_id        TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      alias            TEXT NOT NULL,
      normalized_alias TEXT NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_person_aliases_user_normalized ON person_aliases(user_id, normalized_alias)`;

  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS attributes (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      person_id      TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      category       TEXT NOT NULL,
      key            TEXT NOT NULL,
      value          TEXT NOT NULL,
      confidence     REAL NOT NULL DEFAULT 0.8,
      source_note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
      superseded_by  TEXT REFERENCES attributes(id) ON DELETE SET NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_attributes_user ON attributes(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_attributes_person ON attributes(person_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_attributes_key ON attributes(category, key)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_attributes_value ON attributes(value)`;

  await sql`
    CREATE TABLE IF NOT EXISTS relationships (
      id                  TEXT PRIMARY KEY,
      user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_person_id      TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      to_person_id        TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      type                TEXT NOT NULL,
      label               TEXT,
      confidence          REAL NOT NULL DEFAULT 0.8,
      source_note_id      TEXT REFERENCES notes(id) ON DELETE SET NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reinforcement_count INTEGER NOT NULL DEFAULT 1
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_unique ON relationships(user_id, from_person_id, to_person_id, type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_relationships_user ON relationships(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_person_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS note_mentions (
      id           TEXT PRIMARY KEY,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      note_id      TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      person_id    TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      mention_text TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_note_mentions_user ON note_mentions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_note_mentions_person ON note_mentions(person_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_note_mentions_note ON note_mentions(note_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS summaries (
      person_id    TEXT PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content      TEXT NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_summaries_user ON summaries(user_id)`;
}
