/* eslint-disable no-console */
/**
 * End-to-end smoke test.
 *
 * 1. Loads .env.local
 * 2. Creates (or reuses) a test user in Postgres
 * 3. Ingests 3 sample notes via the real service layer (hits Groq)
 * 4. Mints a session JWT for that user and writes it to a cookie jar
 * 5. Hits every page on a running `npm run dev` server and saves the HTML
 * 6. Writes everything to ./scripts/_smoke_out/
 *
 * Pre-requisite: dev server running on http://localhost:3000.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
loadEnv({ path: path.join(root, ".env.local") });
loadEnv({ path: path.join(root, ".env") });

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const TEST_EMAIL = "smoke@secondbrain.test";
const TEST_PASSWORD = "smoke-test-pw-1234";
const TEST_NAME = "Smoke Tester";

const NOTES = [
  "Met Aarav at the gym today. He works at TCS, doesn't smoke, and seems super disciplined about his routine. Mentioned his girlfriend Maya is a doctor.",
  "Riya is Aarav's cousin. She's into climbing and photography. Studying at IIT Bombay.",
  "Caught up with Maya — she's switched hospitals, now at AIIMS. Loves dogs. Vegetarian.",
];

async function main() {
  const { applySchema } = await import("../lib/db/schema");
  const { sql } = await import("../lib/db/index");
  const { hashPassword } = await import("../lib/auth/password");
  const { signSession, SESSION_CONFIG } = await import("../lib/auth/session");
  const { createUser, findUserByEmail } = await import(
    "../lib/repos/usersRepo"
  );
  const { ingestNote } = await import("../lib/services/ingestService");
  const { listPeople } = await import("../lib/repos/peopleRepo");
  const { config } = await import("../lib/config");

  console.log("[smoke] groq chain:", config.groq.models);

  // 0. ensure schema
  await applySchema();
  console.log("[smoke] schema ok");

  // 1. wipe any prior smoke user so this is reproducible
  const prior = await findUserByEmail(TEST_EMAIL);
  if (prior) {
    await sql`DELETE FROM users WHERE id = ${prior.user.id}`;
    console.log("[smoke] removed prior smoke user");
  }

  // 2. create user
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await createUser(TEST_EMAIL, passwordHash, TEST_NAME);
  console.log("[smoke] user created:", user.id, user.email);

  // 3. ingest notes via the real service layer
  for (const [i, note] of NOTES.entries()) {
    const t0 = Date.now();
    const result = await ingestNote(user.id, note);
    console.log(
      `[smoke] note ${i + 1}/${NOTES.length} ingested in ${Date.now() - t0}ms - ` +
        `${result.people.length} people, +${result.relationships_added} rels`,
    );
  }

  const people = await listPeople(user.id);
  if (people.length === 0) {
    throw new Error("[smoke] no people created — check Groq output");
  }
  const profilePersonId = people[0].id;
  console.log(
    `[smoke] graph has ${people.length} people, profiling ${people[0].name}`,
  );

  // 4. mint a session cookie for HTTP requests
  const token = await signSession(user.id);
  const cookieHeader = `${SESSION_CONFIG.cookie}=${token}`;

  // 5. fetch each page
  const outDir = path.join(__dirname, "_smoke_out");
  await mkdir(outDir, { recursive: true });

  const targets: Array<{ name: string; path: string; auth: boolean }> = [
    { name: "01-signin",            path: "/signin",                                          auth: false },
    { name: "02-signup",            path: "/signup",                                          auth: false },
    { name: "03-capture",           path: "/",                                                auth: true  },
    { name: "04-people",            path: "/people",                                          auth: true  },
    { name: "05-profile",           path: `/people/${profilePersonId}`,                       auth: true  },
    { name: "06-search-tcs",        path: "/search?q=TCS",                                    auth: true  },
    { name: "07-search-doctor",     path: "/search?q=doctor",                                 auth: true  },
    { name: "08-ask",               path: "/ask",                                             auth: true  },
    { name: "09-graph",             path: "/graph",                                           auth: true  },
  ];

  const summary: Array<{
    name: string;
    url: string;
    status: number;
    bytes: number;
    file: string;
  }> = [];

  for (const t of targets) {
    const url = `${BASE_URL}${t.path}`;
    const headers: Record<string, string> = {};
    if (t.auth) headers["cookie"] = cookieHeader;

    const res = await fetch(url, { headers, redirect: "manual" });
    const body = await res.text();
    const file = path.join(outDir, `${t.name}.html`);
    await writeFile(file, body, "utf8");

    summary.push({
      name: t.name,
      url,
      status: res.status,
      bytes: Buffer.byteLength(body, "utf8"),
      file,
    });
    console.log(
      `[smoke] ${t.name.padEnd(22)} ${String(res.status).padEnd(4)} ${Buffer.byteLength(body, "utf8")} bytes -> ${file}`,
    );
  }

  await writeFile(
    path.join(outDir, "_summary.json"),
    JSON.stringify(
      {
        user: { id: user.id, email: user.email, name: user.name },
        people: people.map((p) => ({ id: p.id, name: p.name })),
        captured: summary,
      },
      null,
      2,
    ),
  );

  console.log("\n[smoke] all done. files in:", outDir);
}

main().catch((err) => {
  console.error("[smoke] FAILED:", err);
  process.exit(1);
});
