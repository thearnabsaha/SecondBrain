/**
 * Central runtime configuration. Read from process.env on cold start.
 *
 * On Vercel, env vars are injected automatically. Locally, Next loads
 * `.env.local` for you.
 */

/**
 * Default Groq model fallback chain. Tried in order: capability-first.
 * Each model is retried twice with brief backoff before falling through to
 * the next one (see `lib/llm/groq.ts`).
 */
const DEFAULT_GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-safeguard-20b",
  "llama-3.3-70b-versatile",
] as const;

function resolveGroqModels(): string[] {
  // Optional override: if GROQ_MODEL is set, treat it as a single-model chain
  // (no fallback). Useful for debugging a specific model.
  const override = process.env.GROQ_MODEL?.trim();
  if (override) return [override];

  // Optional advanced override: GROQ_MODELS as a comma-separated list.
  const list = process.env.GROQ_MODELS?.trim();
  if (list) {
    return list
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [...DEFAULT_GROQ_MODELS];
}

export const config = {
  groq: {
    apiKey: process.env.GROQ_API_KEY ?? "",
    models: resolveGroqModels(),
  },
  tavily: {
    apiKey: process.env.TAVILY_API_KEY ?? "",
  },
  postgres: {
    url:
      process.env.POSTGRES_URL ??
      process.env.DATABASE_URL ??
      process.env.POSTGRES_PRISMA_URL ??
      "",
  },
};

export function hasGroq(): boolean {
  return Boolean(config.groq.apiKey);
}

export function hasTavily(): boolean {
  return Boolean(config.tavily.apiKey);
}

export function hasPostgres(): boolean {
  return Boolean(config.postgres.url);
}
