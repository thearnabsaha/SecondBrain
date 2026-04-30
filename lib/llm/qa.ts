import { chat } from "./groq";
import type { Attribute, Note, Person, Relationship } from "../types";

export interface QaContext {
  people: Person[];
  attributes: Attribute[];
  relationships: Array<{
    rel: Relationship;
    fromName: string;
    toName: string;
  }>;
  notes: Note[];
}

const SYSTEM_PROMPT = `You answer questions about people in the user's personal knowledge graph.

You will be given:
- A list of people the user knows.
- Attributes attached to each person.
- Relationships between people.
- Raw notes the user has captured.

Hard rules — non-negotiable:
- Answer ONLY using the provided context. If the answer is not in the context, say so plainly: "I don't have that in your notes." Do not infer, do not guess, do not draw on outside knowledge (e.g. don't conclude a city from an employer name).
- Be specific. Name names. Quote attributes when useful.
- No hedging or softeners. Forbidden phrases: "seems to", "appears to", "likely", "probably", "may", "might", "perhaps", "presumably", "suggests", "based on the data".
- Keep answers concise (1-4 sentences) unless the question explicitly demands a list.
- Never invent people, attributes, relationships, or events.`;

function summarizeContext(ctx: QaContext): string {
  const peopleBlock = ctx.people
    .map((p) => {
      const attrs = ctx.attributes
        .filter((a) => a.person_id === p.id && !a.superseded_by)
        .map((a) => `${a.key}=${a.value}`);
      return `- ${p.name}${attrs.length ? ` :: ${attrs.join(", ")}` : ""}`;
    })
    .join("\n");

  const relBlock = ctx.relationships
    .map(
      (r) =>
        `- ${r.fromName} --[${r.rel.type}${r.rel.label ? `:${r.rel.label}` : ""}]--> ${r.toName}`,
    )
    .join("\n");

  const noteBlock = ctx.notes
    .slice(0, 30)
    .map((n) => `- (${n.created_at}) ${n.content}`)
    .join("\n");

  return `PEOPLE:
${peopleBlock || "(none)"}

RELATIONSHIPS:
${relBlock || "(none)"}

NOTES:
${noteBlock || "(none)"}`;
}

export async function answerQuestion(
  question: string,
  ctx: QaContext,
): Promise<string> {
  return chat({
    system: SYSTEM_PROMPT,
    user: `Context:
${summarizeContext(ctx)}

Question: ${question}

Answer:`,
    temperature: 0,
    maxTokens: 700,
  });
}
