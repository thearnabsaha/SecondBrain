export interface User {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string;
  created_at: string;
  updated_at: string;
}

export interface Attribute {
  id: string;
  user_id: string;
  person_id: string;
  category: AttributeCategory;
  key: string;
  value: string;
  confidence: number;
  source_note_id: string | null;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AttributeCategory =
  | "professional"
  | "personality"
  | "lifestyle"
  | "preference"
  | "life_event"
  | "context"
  | "physical"
  | "skill"
  | "contact"
  | "other";

export interface Relationship {
  id: string;
  user_id: string;
  from_person_id: string;
  to_person_id: string;
  type: RelationshipType;
  label: string | null;
  confidence: number;
  source_note_id: string | null;
  created_at: string;
  last_seen_at: string;
  reinforcement_count: number;
}

export type RelationshipType =
  | "friend"
  | "close_friend"
  | "acquaintance"
  | "romantic_partner"
  | "ex_partner"
  | "spouse"
  | "family"
  | "parent"
  | "child"
  | "sibling"
  | "colleague"
  | "manager"
  | "report"
  | "mentor"
  | "mentee"
  | "classmate"
  | "neighbor"
  | "roommate"
  | "knows"
  | "other";

export interface Note {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface NoteMention {
  id: string;
  user_id: string;
  note_id: string;
  person_id: string;
  mention_text: string | null;
}

export interface Summary {
  person_id: string;
  user_id: string;
  /** Prose summary, 2-4 short paragraphs. Always present. */
  content: string;
  /**
   * Newline-separated bullet points (5-7 lines). Stored as a single TEXT
   * column to avoid a second table; the UI splits on `\n`. Null for old
   * rows generated before the Bullets feature shipped — the UI falls back
   * to splitting `content` into sentences in that case.
   */
  bullets: string | null;
  generated_at: string;
}

export interface ExtractionPayload {
  people: ExtractedPerson[];
  relationships: ExtractedRelationship[];
}

export interface ExtractedPerson {
  name: string;
  aliases?: string[];
  attributes: ExtractedAttribute[];
}

export interface ExtractedAttribute {
  category: AttributeCategory;
  key: string;
  value: string;
  confidence: number;
}

export interface ExtractedRelationship {
  from: string;
  to: string;
  type: RelationshipType;
  label?: string;
  confidence: number;
}

export type PendingNoteKind = "db_unreachable" | "llm_failed";

export interface PendingNote {
  note_id: string;
  user_id: string;
  kind: PendingNoteKind;
  reason: string;
  attempts: number;
  created_at: string;
  retried_at: string | null;
}

export interface IngestResult {
  note_id: string;
  people: Array<{
    id: string;
    name: string;
    is_new: boolean;
    attributes_added: number;
  }>;
  relationships_added: number;
  relationships_reinforced: number;
  /**
   * If extraction couldn't run, the raw note is still persisted but
   * processing is deferred. UI surfaces this so the user can retry.
   */
  pending?: {
    reason: string;
    /**
     * What sub-step actually failed. Lets the UI tailor its hint:
     *   - "db_unreachable": Postgres (Neon) couldn't be reached at all.
     *     Almost always a transient DNS / WiFi hiccup, not a config issue.
     *   - "llm_failed": Postgres worked, but the Groq call failed. May be
     *     a real outage, a moderation refusal, or a network block — see
     *     `suspectedNetworkBlock`.
     */
    kind: "db_unreachable" | "llm_failed";
    /** True when we suspect a corporate proxy / VPN block, not a real outage.
     *  Only meaningful when `kind === "llm_failed"`. */
    suspectedNetworkBlock: boolean;
  };
}
