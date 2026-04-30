import { z } from "zod";
import { chat } from "./groq";
import { tavilySearch } from "./tavily";
import type {
  Attribute,
  AttributeCategory,
  ExtractedAttribute,
  Person,
} from "../types";

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

const PayloadSchema = z.object({
  attributes: z.array(AttributeSchema).default([]),
  rationale: z.string().optional(),
});

const SYSTEM_PROMPT = `You are enriching a personal People Knowledge Graph using public web search snippets.

You will be given:
- A person's existing profile (attributes already known).
- Snippets from a web search about something specific (a company, a school, a public role, etc.).

Your job: propose ADDITIONAL structured attributes that are clearly supported by the snippets and would help the user understand this person better. Things like:
- Industry of their employer ("TCS" -> industry: IT services).
- Headquarters location of their company.
- Notable info about their school.
- Any public, factual context tied to something they're already associated with.

Rules:
- Output ONLY valid JSON. No prose. No markdown fences.
- DO NOT invent personal facts. Only attribute things that are clearly tied to the company/school/etc. mentioned in the snippets.
- DO NOT duplicate attributes that already exist on the profile.
- Set confidence between 0.3 and 0.7 — these are inferred from public info, not stated by the user.
- Categories: same set as the main extractor (professional, personality, lifestyle, preference, life_event, context, physical, skill, contact, other).

JSON schema:
{
  "attributes": [
    { "category": "...", "key": "...", "value": "...", "confidence": 0.0-1.0 }
  ],
  "rationale": "1-2 sentence summary of what was learned"
}`;

interface EnrichInput {
  person: Person;
  attributes: Attribute[];
  query: string;
}

export interface EnrichResult {
  attributes: ExtractedAttribute[];
  rationale: string | null;
  sources: Array<{ title: string; url: string }>;
}

/**
 * Run a Tavily search using `query`, then have Groq propose new attributes
 * grounded in the snippets. The caller decides which attributes to persist.
 */
export async function enrichPerson(input: EnrichInput): Promise<EnrichResult> {
  const search = await tavilySearch(input.query, {
    maxResults: 5,
    includeAnswer: true,
  });

  if (search.results.length === 0) {
    return { attributes: [], rationale: null, sources: [] };
  }

  const existingAttrLines = input.attributes
    .map((a) => `- [${a.category}] ${a.key}: ${a.value}`)
    .join("\n");

  const snippetBlock = search.results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\n${r.content.slice(0, 600)}\nSOURCE: ${r.url}`,
    )
    .join("\n\n");

  const userPrompt = `Person: ${input.person.name}

Existing profile:
${existingAttrLines || "(none)"}

Web search query: "${input.query}"
${search.answer ? `\nLLM-summarized answer: ${search.answer}\n` : ""}

Snippets:
${snippetBlock}

Return JSON only.`;

  type ParsedPayload = z.infer<typeof PayloadSchema>;

  let parsed: ParsedPayload;
  try {
    parsed = await chat<ParsedPayload>({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      json: true,
      temperature: 0.2,
      maxTokens: 800,
      validate: (raw) => {
        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch {
          throw new Error(`non-JSON output: ${raw.slice(0, 120)}`);
        }
        const result = PayloadSchema.safeParse(json);
        if (!result.success) {
          throw new Error(`schema validation: ${result.error.message}`);
        }
        return result.data;
      },
    });
  } catch (err) {
    // Whole chain failed (every model produced bad JSON / errored). Surface
    // the Tavily sources so the user still sees something useful.
    return {
      attributes: [],
      rationale: `Enrichment failed: ${(err as Error).message}`,
      sources: search.results.map((r) => ({ title: r.title, url: r.url })),
    };
  }

  // Extra dedupe: drop anything already on the profile by (category, key, value).
  const existing = new Set(
    input.attributes.map(
      (a) =>
        `${a.category}|${a.key.toLowerCase()}|${a.value.toLowerCase()}` as const,
    ),
  );
  const novel = (parsed.attributes as ExtractedAttribute[]).filter(
    (a) =>
      !existing.has(
        `${a.category as AttributeCategory}|${a.key.toLowerCase()}|${a.value.toLowerCase()}`,
      ),
  );

  return {
    attributes: novel,
    rationale: parsed.rationale ?? null,
    sources: search.results.map((r) => ({ title: r.title, url: r.url })),
  };
}
