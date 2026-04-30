import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { config, hasPostgres } from "../config";
import { applySchema } from "./schema";

let sqlClient: NeonQueryFunction<false, false> | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Lazily build the Neon SQL client. We use a templated query function so all
 * repo code reads naturally as `sql\`SELECT ... ${id}\``.
 *
 * Works with any Postgres connection string:
 *   - Vercel Postgres / Neon native integration (POSTGRES_URL set automatically)
 *   - Standalone Neon project
 *   - Supabase
 *   - Any other provider that exposes a Postgres connection string
 */
export function getSql(): NeonQueryFunction<false, false> {
  if (sqlClient) return sqlClient;
  if (!hasPostgres()) {
    throw new Error(
      "POSTGRES_URL is not configured. Add it to .env.local (or to your Vercel project env).",
    );
  }
  sqlClient = neon(config.postgres.url);
  return sqlClient;
}

/**
 * Compatibility shim so existing repos that import `{ sql }` keep working.
 * It's a tagged template that delegates to the lazily-initialized client.
 */
export const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
  return getSql()(strings, ...values);
}) as NeonQueryFunction<false, false>;

/**
 * Lazily ensure the schema exists. Memoized per warm function instance so
 * repeated calls within the same lambda are essentially free.
 */
export async function ensureSchema(): Promise<void> {
  if (!hasPostgres()) {
    throw new Error(
      "POSTGRES_URL is not configured. Add it to .env.local (or to your Vercel project env).",
    );
  }
  if (!initPromise) {
    initPromise = applySchema().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}
