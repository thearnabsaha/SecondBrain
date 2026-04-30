/**
 * Central runtime configuration. Read from process.env on cold start.
 *
 * On Vercel, env vars are injected automatically. Locally, dotenv is loaded
 * by the Vercel CLI (`vercel dev`) or you can `vercel env pull .env`.
 */

export const config = {
  groq: {
    apiKey: process.env.GROQ_API_KEY ?? "",
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
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
