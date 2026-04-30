import { chat } from "./groq";
import type { Attribute, Note, Person, Relationship } from "../types";

interface SummaryInput {
  person: Person;
  attributes: Attribute[];
  relationships: Array<{
    rel: Relationship;
    otherName: string;
    direction: "out" | "in";
  }>;
  recentNotes: Note[];
}

const SYSTEM_PROMPT = `You write concise, human-feeling profiles of people based on structured notes the user has captured over time.

Write 2-4 short paragraphs. Cover:
1. Who they are - what they do, where they fit in the user's life.
2. What they're like - personality, lifestyle, preferences.
3. Notable connections - significant relationships to other people.
4. Recent context if applicable.

Rules:
- Speak in third person, present tense.
- Do not mention "the user" or "the system" or "data". Just describe the person.
- Do not invent details. If a fact is uncertain, hedge ("seems to", "appears to").
- Keep it under 180 words. No bullet points. No headings.`;

export async function generateSummary(input: SummaryInput): Promise<string> {
  const { person, attributes, relationships, recentNotes } = input;

  const attrLines = attributes.map(
    (a) =>
      `  - [${a.category}] ${a.key}: ${a.value} (confidence ${a.confidence.toFixed(2)})`,
  );

  const relLines = relationships.map(({ rel, otherName, direction }) => {
    const arrow = direction === "out" ? "->" : "<-";
    const label = rel.label ? ` "${rel.label}"` : "";
    return `  - ${arrow} ${otherName} [${rel.type}]${label} (reinforced ${rel.reinforcement_count}x)`;
  });

  const noteLines = recentNotes
    .slice(0, 8)
    .map((n) => `  - (${n.created_at}) ${n.content}`);

  const userPrompt = `Person: ${person.name}

Attributes:
${attrLines.length ? attrLines.join("\n") : "  (none yet)"}

Relationships:
${relLines.length ? relLines.join("\n") : "  (none yet)"}

Recent notes mentioning them:
${noteLines.length ? noteLines.join("\n") : "  (none yet)"}

Write the profile.`;

  return chat({
    system: SYSTEM_PROMPT,
    user: userPrompt,
    temperature: 0.4,
    maxTokens: 500,
  });
}
