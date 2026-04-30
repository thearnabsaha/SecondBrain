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

Rules:
- Answer ONLY using the provided context. If the answer is not in the context, say so plainly.
- Be specific. Name names. Quote attributes when useful.
- Keep answers concise (1-4 sentences) unless the question demands a list.
- Never invent people or facts.`;

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
    temperature: 0.2,
    maxTokens: 700,
  });
}
