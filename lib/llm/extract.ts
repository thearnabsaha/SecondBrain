import { z } from "zod";
import { chat } from "./groq";
import type { ExtractionPayload, Person } from "../types";

const AttributeSchema = z.object({
  category: z.enum([
    "professional",
    "personality",
    "lifestyle",
    "preference",
    "life_event",
    "context",
    "physical",
    "skill",
    "contact",
    "other",
  ]),
  key: z.string().min(1),
  value: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const PersonSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  attributes: z.array(AttributeSchema).default([]),
});

const RelationshipSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.enum([
    "friend",
    "close_friend",
    "acquaintance",
    "romantic_partner",
    "ex_partner",
    "spouse",
    "family",
    "parent",
    "child",
    "sibling",
    "colleague",
    "manager",
    "report",
    "mentor",
    "mentee",
    "classmate",
    "neighbor",
    "roommate",
    "knows",
    "other",
  ]),
  label: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

const PayloadSchema = z.object({
  people: z.array(PersonSchema).default([]),
  relationships: z.array(RelationshipSchema).default([]),
});

const SYSTEM_PROMPT = `You are the intelligence layer of a personal People Knowledge Graph.

Your job: read a short, messy note from the user and extract structured information about the people mentioned, their attributes, and the relationships between them.

Hard rules:
- Output ONLY valid JSON matching the schema below. No prose. No markdown fences.
- Identify every person mentioned, including pronoun referents when clearly resolvable.
- For attributes, prefer specific, observable facts over vague impressions.
- Use the lowest-level category that fits. Examples:
    professional   -> job, employer, role, industry
    personality    -> traits, values, temperament
    lifestyle      -> habits, routines, hobbies
    preference     -> likes, dislikes, favorites
    life_event     -> milestones, moves, breakups, marriages
    context        -> where/how the user knows them, meeting context
    physical       -> appearance
    skill          -> abilities
    contact        -> phone, email, handles
    other          -> anything that doesn't fit
- Confidence is a float in [0,1]:
    1.0  explicitly stated as fact
    0.7  strongly implied
    0.4  loosely inferred
    0.2  speculative
- For relationships, infer implicit ones when clearly supported (e.g. "his girlfriend Maya" -> {from: <him>, to: "Maya", type: "romantic_partner"}). Always include BOTH directions only when the relationship is symmetric (friend, sibling, spouse). For asymmetric relationships (parent/child, manager/report) emit one directed edge.
- Names: use the most complete form mentioned in the note. If only a pronoun is given for someone known from context, use a name only if you are confident; otherwise omit them.
- Do not invent facts that are not supported by the note.

JSON schema:
{
  "people": [
    {
      "name": "string",
      "aliases": ["string", ...],
      "attributes": [
        {
          "category": "professional|personality|lifestyle|preference|life_event|context|physical|skill|contact|other",
          "key": "short snake_case label e.g. employer, hobby, smokes",
          "value": "the actual value e.g. TCS, climbing, no",
          "confidence": 0.0-1.0
        }
      ]
    }
  ],
  "relationships": [
    {
      "from": "name of person A",
      "to":   "name of person B",
      "type": "one of the allowed types",
      "label": "optional free-form qualifier e.g. 'college roommate'",
      "confidence": 0.0-1.0
    }
  ]
}`;

function buildUserPrompt(note: string, knownPeople: Person[]): string {
  const knownList = knownPeople.length
    ? knownPeople
        .slice(0, 200)
        .map((p) => `- ${p.name}`)
        .join("\n")
    : "(none yet)";

  return `Already known people in the user's graph (use these exact names when the note refers to them):
${knownList}

New note:
"""
${note}
"""

Return JSON only.`;
}

export async function extractFromNote(
  note: string,
  knownPeople: Person[],
): Promise<ExtractionPayload> {
  return chat<ExtractionPayload>({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(note, knownPeople),
    json: true,
    temperature: 0.15,
    maxTokens: 1500,
    /**
     * Throwing here makes the runner skip to the next model in the fallback
     * chain instead of failing ingest. So if `gpt-oss-120b` returns garbage
     * JSON, we automatically retry on `gpt-oss-20b`, and so on.
     */
    validate: (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`non-JSON output: ${raw.slice(0, 120)}`);
      }
      const result = PayloadSchema.safeParse(parsed);
      if (!result.success) {
        throw new Error(`schema validation: ${result.error.message}`);
      }
      return result.data as ExtractionPayload;
    },
  });
}
