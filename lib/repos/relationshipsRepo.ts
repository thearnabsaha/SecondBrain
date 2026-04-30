import { nanoid } from "nanoid";
import { sql } from "../db/index";
import type { Relationship, RelationshipType } from "../types";

const SYMMETRIC_TYPES = new Set<RelationshipType>([
  "friend",
  "close_friend",
  "acquaintance",
  "romantic_partner",
  "ex_partner",
  "spouse",
  "sibling",
  "colleague",
  "classmate",
  "neighbor",
  "roommate",
  "knows",
]);

const INVERSE_TYPE: Partial<Record<RelationshipType, RelationshipType>> = {
  parent: "child",
  child: "parent",
  manager: "report",
  report: "manager",
  mentor: "mentee",
  mentee: "mentor",
};

export interface UpsertRelationshipInput {
  userId: string;
  fromId: string;
  toId: string;
  type: RelationshipType;
  label: string | null;
  confidence: number;
  sourceNoteId: string | null;
}

export interface UpsertRelationshipResult {
  added: number;
  reinforced: number;
}

async function upsertOne(
  userId: string,
  fromId: string,
  toId: string,
  type: RelationshipType,
  label: string | null,
  confidence: number,
  sourceNoteId: string | null,
): Promise<{ added: boolean }> {
  const existing = (await sql`
    SELECT * FROM relationships
     WHERE user_id        = ${userId}
       AND from_person_id = ${fromId}
       AND to_person_id   = ${toId}
       AND type           = ${type}
  `) as Relationship[];
  if (existing[0]) {
    await sql`
      UPDATE relationships
         SET last_seen_at = NOW(),
             reinforcement_count = reinforcement_count + 1,
             confidence = GREATEST(confidence, ${confidence}),
             label = COALESCE(${label}, label),
             source_note_id = COALESCE(source_note_id, ${sourceNoteId})
       WHERE id = ${existing[0].id}
    `;
    return { added: false };
  }
  await sql`
    INSERT INTO relationships
      (id, user_id, from_person_id, to_person_id, type, label, confidence, source_note_id)
    VALUES
      (${nanoid(12)}, ${userId}, ${fromId}, ${toId}, ${type}, ${label}, ${confidence}, ${sourceNoteId})
  `;
  return { added: true };
}

export async function upsertRelationship(
  input: UpsertRelationshipInput,
): Promise<UpsertRelationshipResult> {
  if (input.fromId === input.toId) return { added: 0, reinforced: 0 };

  let added = 0;
  let reinforced = 0;

  const primary = await upsertOne(
    input.userId,
    input.fromId,
    input.toId,
    input.type,
    input.label,
    input.confidence,
    input.sourceNoteId,
  );
  primary.added ? added++ : reinforced++;

  if (SYMMETRIC_TYPES.has(input.type)) {
    const r = await upsertOne(
      input.userId,
      input.toId,
      input.fromId,
      input.type,
      input.label,
      input.confidence,
      input.sourceNoteId,
    );
    r.added ? added++ : reinforced++;
  } else if (INVERSE_TYPE[input.type]) {
    const r = await upsertOne(
      input.userId,
      input.toId,
      input.fromId,
      INVERSE_TYPE[input.type] as RelationshipType,
      input.label,
      input.confidence,
      input.sourceNoteId,
    );
    r.added ? added++ : reinforced++;
  }

  return { added, reinforced };
}

export async function getRelationshipsForPerson(
  userId: string,
  personId: string,
): Promise<Relationship[]> {
  return (await sql`
    SELECT * FROM relationships
     WHERE user_id = ${userId}
       AND (from_person_id = ${personId} OR to_person_id = ${personId})
     ORDER BY last_seen_at DESC
  `) as Relationship[];
}

export async function getAllRelationships(
  userId: string,
): Promise<Relationship[]> {
  return (await sql`
    SELECT * FROM relationships
     WHERE user_id = ${userId}
     ORDER BY last_seen_at DESC
  `) as Relationship[];
}

export async function deleteRelationship(
  userId: string,
  id: string,
): Promise<void> {
  await sql`DELETE FROM relationships WHERE id = ${id} AND user_id = ${userId}`;
}
