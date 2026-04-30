import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { config, hasPostgres } from "../config";
import { applySchema } from "./schema";

let sqlClient: NeonQueryFunction<false, false> | null = null;

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
 *
 * In dev, Next.js's HMR resets module-scoped state on every recompile, which
 * means the original module-level `initPromise` was getting reset — and
 * applySchema (15+ DDL round-trips) was running on every page load. Pin the
 * memo to globalThis so it survives HMR; in production this is functionally
 * identical to a module-level memo since modules are evaluated once.
 */
const SCHEMA_KEY = Symbol.for("secondbrain.ensureSchema.promise");
type SchemaGlobal = typeof globalThis & {
  [SCHEMA_KEY]?: Promise<void>;
};

export async function ensureSchema(): Promise<void> {
  if (!hasPostgres()) {
    throw new Error(
      "POSTGRES_URL is not configured. Add it to .env.local (or to your Vercel project env).",
    );
  }
  const g = globalThis as SchemaGlobal;
  if (!g[SCHEMA_KEY]) {
    g[SCHEMA_KEY] = applySchema().catch((err) => {
      g[SCHEMA_KEY] = undefined;
      throw err;
    });
  }
  return g[SCHEMA_KEY];
}
