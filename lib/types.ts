export interface Person {
  id: string;
  name: string;
  normalized_name: string;
  created_at: string;
  updated_at: string;
}

export interface Attribute {
  id: string;
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
  content: string;
  created_at: string;
}

export interface NoteMention {
  id: string;
  note_id: string;
  person_id: string;
  mention_text: string | null;
}

export interface Summary {
  person_id: string;
  content: string;
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
}
