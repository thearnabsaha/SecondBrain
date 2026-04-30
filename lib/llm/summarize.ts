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

/**
 * Strict, evidence-only profile writer. Originally the prompt allowed
 * hedging ("seems to", "appears to") which the model used as a license to
 * infer ("Works at TCS" -> "Lives in India"). The user explicitly wants
 * NOTHING that wasn't recorded — so:
 *
 * - the prompt forbids inference, paraphrasing values, and hedging;
 * - the temperature is 0 so the model doesn't get creative across runs;
 * - a server-side guard (filterGroundedBullets) drops any bullet whose
 *   meaningful words don't appear in the source data.
 */
const SYSTEM_PROMPT = `You write a strict, evidence-only profile of a person from a knowledge graph.

You will receive a list of EXPLICIT FACTS (attributes, relationships, and the original notes the user wrote). These are the ONLY things you may state.

Hard rules — non-negotiable:
- State only facts that are literally present in the EXPLICIT FACTS. Do not infer, deduce, or generalize. Example: if "employer = TCS" is the only location-related fact, you MUST NOT mention any city, state, or country — TCS being headquartered somewhere is not a fact about THIS person.
- Use the exact wording of values when possible. Don't paraphrase "TCS" as "a tech company" or "doctor" as "in healthcare".
- No hedging, no softeners. Forbidden phrases: "seems to", "appears to", "likely", "probably", "may", "might", "perhaps", "it is unclear", "based on", "according to", "the user", "the data", "the notes", "the system", "presumably", "suggests".
- If a section has nothing to say, omit it. A 1-sentence profile is better than a padded one.
- No greetings, no meta-commentary, no closing remarks. Just the profile.

Format:
- 1-3 short paragraphs. Third person, present tense.
- Under 120 words total.
- No bullet points, no headings, no markdown.`;

const BULLETS_SYSTEM_PROMPT = `You write a strict, evidence-only bulleted profile of a person from a knowledge graph.

You will receive a list of EXPLICIT FACTS (attributes, relationships, and the original notes the user wrote). These are the ONLY things you may state.

Hard rules — non-negotiable:
- Each bullet must be a fact LITERALLY present in EXPLICIT FACTS. No inference, no deduction, no generalization. Example: "employer = TCS" does NOT permit a "Lives in India" bullet.
- Use the actual values verbatim where possible. Don't paraphrase "TCS" -> "tech company".
- No hedging or softeners. Forbidden tokens: seems, appears, likely, probably, may, might, perhaps, presumably, suggests, possibly, it seems.
- No filler bullets. If you only have 3 facts, return exactly 3 bullets. Do not pad to reach a target count.
- Skip attributes with confidence < 0.5.
- One fact per bullet. 6-12 words. Third person, present tense.
- No emoji, no headings, no prefixes like "•" or "-".

Return strict JSON in this exact shape, no prose before or after:
{"bullets": ["string", ...]}

If you have zero qualifying facts, return {"bullets": []}.`;

function buildContext(input: SummaryInput): string {
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

  return `Person: ${person.name}

EXPLICIT FACTS — Attributes:
${attrLines.length ? attrLines.join("\n") : "  (none)"}

EXPLICIT FACTS — Relationships:
${relLines.length ? relLines.join("\n") : "  (none)"}

EXPLICIT FACTS — Notes the user wrote (verbatim):
${noteLines.length ? noteLines.join("\n") : "  (none)"}`;
}

export async function generateSummary(input: SummaryInput): Promise<string> {
  const raw = await chat({
    system: SYSTEM_PROMPT,
    user: `${buildContext(input)}\n\nWrite the profile.`,
    temperature: 0,
    maxTokens: 500,
  });
  return stripHedgedSentences(raw);
}

/**
 * Removes any sentence that contains a hedging word ("seems", "appears",
 * "likely", etc.). The model may still try to slip these in even with a
 * strict prompt; dropping the whole sentence is safer than trying to
 * surgically remove the hedge and end up with broken grammar.
 *
 * Returns the joined remaining sentences. If everything was a hedge, we
 * fall back to the raw text rather than serving an empty summary — the
 * UI's "no summary yet" state is misleading in that case, and the bullets
 * grounding filter is the real safety net.
 */
function stripHedgedSentences(prose: string): string {
  const text = prose.trim();
  if (!text) return text;
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const kept = sentences.filter((s) => !HEDGE_RE.test(s));
  if (kept.length === 0) return text;
  return kept.join(" ").trim();
}

/**
 * Returns short, evidence-only bullets describing the person. Asks the LLM
 * for strict JSON ({"bullets": ["…","…"]}) so we can render reliably; throws
 * on unparseable output so chat() falls through to the next model.
 *
 * Two layers of safety beyond the strict prompt:
 *   1. A hedging filter drops any bullet that uses "seems"/"appears"/etc.
 *   2. A grounding filter drops any bullet whose meaningful words don't
 *      appear in the source attributes / relationships / notes — this
 *      catches inferences like "Lives in India" derived from "TCS".
 */
export async function generateBullets(input: SummaryInput): Promise<string[]> {
  const sourceText = buildSourceCorpus(input);
  const personName = input.person.name;

  return chat<string[]>({
    system: BULLETS_SYSTEM_PROMPT,
    user: `${buildContext(input)}\n\nReturn the JSON.`,
    json: true,
    temperature: 0,
    maxTokens: 600,
    validate: (raw) => {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Bullets response is not a JSON object.");
      }
      const arr = (parsed as { bullets?: unknown }).bullets;
      if (!Array.isArray(arr)) {
        throw new Error('Bullets response is missing a "bullets" array.');
      }

      const cleaned: string[] = [];
      const seen = new Set<string>();
      for (const item of arr) {
        if (typeof item !== "string") continue;
        const trimmed = item
          .replace(/^[\s•\-*\u2022]+/, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!trimmed) continue;
        if (HEDGE_RE.test(trimmed)) continue;
        if (!isGrounded(trimmed, sourceText, personName)) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push(trimmed);
        if (cleaned.length >= 8) break;
      }
      // Empty list is a valid answer ("we have no qualifying facts"). Don't
      // throw — return [] so the UI shows a clean empty state instead of
      // the chat() runner falling through to other models that might be
      // more cooperative about inventing things.
      return cleaned;
    },
  });
}

/** Words/phrases that signal guessing. Whole-word match, case-insensitive. */
const HEDGE_RE =
  /\b(seems?|appears?|likely|probabl[yi]|may|might|perhaps|presumably|suggest(s|ed)?|possibl[yi]|apparent[lyi]+|it is unclear|based on|according to|the user|the data|the notes?)\b/i;

/**
 * Build a single normalized lowercase corpus of every fact source so we
 * can do cheap substring containment checks. Includes attribute keys and
 * values, relationship types and labels, the connected person's name, and
 * the verbatim text of every note. Words are stripped to lowercase and
 * stripped of punctuation so "TCS." matches "TCS".
 */
function buildSourceCorpus(input: SummaryInput): string {
  const parts: string[] = [];
  parts.push(input.person.name);
  for (const a of input.attributes) {
    parts.push(a.key);
    parts.push(a.value);
    parts.push(a.category);
  }
  for (const r of input.relationships) {
    parts.push(r.otherName);
    parts.push(r.rel.type);
    if (r.rel.label) parts.push(r.rel.label);
  }
  for (const n of input.recentNotes) {
    parts.push(n.content);
  }
  return parts.join(" ").toLowerCase();
}

/**
 * Returns true iff every "meaningful" token in the bullet appears somewhere
 * in the source corpus. Stop-words are ignored. Subject-name tokens are
 * ignored (the bullet is *about* this person). Numbers pass through (cheap
 * heuristic — bullets very rarely contain numbers anyway).
 *
 * Conservative: erring on the side of dropping a bullet is fine because
 * the LLM will offer plenty.
 */
function isGrounded(
  bullet: string,
  sourceCorpus: string,
  personName: string,
): boolean {
  const subjectTokens = tokenize(personName);
  const tokens = tokenize(bullet).filter(
    (t) => !STOP_WORDS.has(t) && !subjectTokens.includes(t),
  );
  if (tokens.length === 0) return true; // nothing to verify
  for (const t of tokens) {
    if (/^\d+$/.test(t)) continue;
    if (!sourceCorpus.includes(t)) return false;
  }
  return true;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Conservative English stop-words list — only obvious ones so we don't
 *  accidentally green-light invented content words.  */
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "has", "have", "had", "do", "does", "did", "will", "would", "should",
  "and", "or", "but", "so", "of", "in", "on", "at", "to", "for", "with",
  "from", "by", "as", "into", "about", "this", "that", "these", "those",
  "their", "his", "her", "him", "she", "he", "they", "them", "it", "its",
  "also", "very", "really", "just", "than", "then", "there", "here",
  "who", "whom", "what", "which", "where", "when", "why", "how",
  "not", "no", "yes", "more", "most", "less", "least",
  "person", "people",
]);
