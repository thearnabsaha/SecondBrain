import { sql } from "./index";

/**
 * Idempotent schema migration. Safe to run on every cold start.
 *
 * Postgres-flavored equivalent of the original SQLite schema.
 * - TEXT columns instead of VARCHAR — Postgres handles them identically.
 * - timestamptz with default now() for created_at / updated_at.
 * - JSONB-free design: keeping a normalized relational model is easier to
 *   query for graph operations.
 */
export async function applySchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS people (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_people_normalized_name ON people(normalized_name)`;

  await sql`
    CREATE TABLE IF NOT EXISTS person_aliases (
      id               TEXT PRIMARY KEY,
      person_id        TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      alias            TEXT NOT NULL,
      normalized_alias TEXT NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_person_aliases_normalized ON person_aliases(normalized_alias)`;

  // Notes are referenced by attributes/relationships, so create them first.
  await sql`
    CREATE TABLE IF NOT EXISTS notes (
      id         TEXT PRIMARY KEY,
      content    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS attributes (
      id             TEXT PRIMARY KEY,
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
  await sql`CREATE INDEX IF NOT EXISTS idx_attributes_person ON attributes(person_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_attributes_key ON attributes(category, key)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_attributes_value ON attributes(value)`;

  await sql`
    CREATE TABLE IF NOT EXISTS relationships (
      id                  TEXT PRIMARY KEY,
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
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_unique ON relationships(from_person_id, to_person_id, type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_person_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS note_mentions (
      id           TEXT PRIMARY KEY,
      note_id      TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      person_id    TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      mention_text TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_note_mentions_person ON note_mentions(person_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_note_mentions_note ON note_mentions(note_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS summaries (
      person_id    TEXT PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE,
      content      TEXT NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}
