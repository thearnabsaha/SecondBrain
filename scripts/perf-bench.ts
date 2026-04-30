/* eslint-disable no-console */
/**
 * Lightweight perf benchmark.
 *
 * Pre-req: dev server running on http://localhost:3000.
 * Reuses the smoke-test user (created by smoke-e2e.ts) for auth so we can
 * hit the authenticated routes without going through the signin flow.
 *
 * Usage:
 *   npx tsx scripts/perf-bench.ts
 *
 * Output: prints per-route p50/p95/min/max over N samples after a warm-up.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
loadEnv({ path: path.join(root, ".env.local") });
loadEnv({ path: path.join(root, ".env") });

const BASE_URL = process.env.PERF_BASE_URL ?? "http://localhost:3000";
const TEST_EMAIL = process.env.PERF_TEST_EMAIL ?? "smoke@secondbrain.test";
const SAMPLES = Number(process.env.PERF_SAMPLES ?? 5);
const WARMUP = Number(process.env.PERF_WARMUP ?? 2);

async function main() {
  const { sql } = await import("../lib/db/index");
  const { signSession, SESSION_CONFIG } = await import("../lib/auth/session");

  const userRows = (await sql`
    SELECT id FROM users WHERE email = ${TEST_EMAIL.toLowerCase()} LIMIT 1
  `) as Array<{ id: string }>;
  if (!userRows[0]) {
    console.error(
      `No user found with email ${TEST_EMAIL}. Run \`npx tsx scripts/smoke-e2e.ts\` first to seed a test account.`,
    );
    process.exit(1);
  }
  const uid = userRows[0].id;

  const peopleRows = (await sql`
    SELECT id FROM people WHERE user_id = ${uid} ORDER BY updated_at DESC LIMIT 1
  `) as Array<{ id: string }>;
  const samplePersonId = peopleRows[0]?.id;

  const token = await signSession(uid);
  const cookie = `${SESSION_CONFIG.cookie}=${token}`;

  const routes: Array<{ name: string; path: string }> = [
    { name: "/ (capture)", path: "/" },
    { name: "/people", path: "/people" },
    { name: "/graph", path: "/graph" },
    { name: "/search?q=doctor", path: "/search?q=doctor" },
    { name: "/ask", path: "/ask" },
  ];
  if (samplePersonId) {
    routes.push({
      name: `/people/[id]`,
      path: `/people/${samplePersonId}`,
    });
  }

  console.log(
    `\nBench against ${BASE_URL} as user ${uid.slice(0, 6)}…  (${WARMUP} warmup + ${SAMPLES} sample requests per route)\n`,
  );
  console.log(
    "route".padEnd(22) +
      "p50".padStart(8) +
      "p95".padStart(8) +
      "min".padStart(8) +
      "max".padStart(8) +
      "  status",
  );
  console.log("-".repeat(60));

  for (const r of routes) {
    for (let i = 0; i < WARMUP; i++) await timed(r.path, cookie);
    const samples: number[] = [];
    let lastStatus = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const { ms, status } = await timed(r.path, cookie);
      samples.push(ms);
      lastStatus = status;
    }
    samples.sort((a, b) => a - b);
    const p = (q: number) =>
      samples[Math.min(samples.length - 1, Math.floor((samples.length - 1) * q))];
    console.log(
      r.name.padEnd(22) +
        `${p(0.5).toFixed(0)}ms`.padStart(8) +
        `${p(0.95).toFixed(0)}ms`.padStart(8) +
        `${samples[0].toFixed(0)}ms`.padStart(8) +
        `${samples[samples.length - 1].toFixed(0)}ms`.padStart(8) +
        `  ${lastStatus}`,
    );
  }
  console.log();
}

async function timed(
  pathname: string,
  cookie: string,
): Promise<{ ms: number; status: number }> {
  const t0 = performance.now();
  const res = await fetch(`${BASE_URL}${pathname}`, {
    method: "GET",
    redirect: "manual",
    headers: { cookie },
  });
  await res.text();
  const ms = performance.now() - t0;
  return { ms, status: res.status };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
