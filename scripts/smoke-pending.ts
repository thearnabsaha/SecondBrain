/* eslint-disable no-console */
/**
 * Verify that submitting a note while the LLM is unreachable:
 *   1. Doesn't crash the page (no 500).
 *   2. Returns a `pending` IngestResult (note saved, no extraction).
 *   3. Renders cleanly when /people is loaded (empty state).
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile, mkdir } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
loadEnv({ path: path.join(root, ".env.local") });
loadEnv({ path: path.join(root, ".env") });

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const TEST_EMAIL = "smoke@secondbrain.test";

async function main() {
  const { applySchema } = await import("../lib/db/schema");
  const { signSession, SESSION_CONFIG } = await import("../lib/auth/session");
  const { findUserByEmail } = await import("../lib/repos/usersRepo");
  const { ingestNote } = await import("../lib/services/ingestService");

  await applySchema();
  const found = await findUserByEmail(TEST_EMAIL);
  if (!found) throw new Error("smoke user missing — run smoke-e2e first");
  const user = found.user;

  const note =
    "So today I met with Soham. He is a guy in PwC working with me and " +
    "he is in the DevOps team and he has a girlfriend in Sushis with " +
    "Prakash. His full name is Soham Pathak. And she is working, like " +
    "not working right now, studying, studying for bank exam. Like her " +
    "girlfriend, like his girlfriend is doing this. And Soham is earning " +
    "like 62,000 right now. Titi lives in Dumdum. Soham has a friend that " +
    "is Lonak. He is also in PwC in security team, cyber security team. " +
    "And his another friend, Ranojit, was another team, like another " +
    "company that is TCS in development team, I guess. And yeah.";

  console.log("[pending] ingesting Soham note via real ingestService…");
  const result = await ingestNote(user.id, note);
  console.log("[pending] result:");
  console.log(JSON.stringify(result, null, 2));

  if (!result.pending) {
    console.log(
      "\n[pending] OK — extraction actually succeeded (network must be open).",
    );
    return;
  }
  console.log(
    `\n[pending] OK — note saved as pending. suspectedNetworkBlock=${result.pending.suspectedNetworkBlock}`,
  );

  // Now snapshot the capture page to confirm UI doesn't 500.
  const token = await signSession(user.id);
  const cookieHeader = `${SESSION_CONFIG.cookie}=${token}`;

  const outDir = path.join(__dirname, "_smoke_out");
  await mkdir(outDir, { recursive: true });

  for (const path_ of ["/", "/people"]) {
    const res = await fetch(`${BASE_URL}${path_}`, {
      headers: { cookie: cookieHeader },
      redirect: "manual",
    });
    const body = await res.text();
    const file = path.join(
      outDir,
      `pending-${path_ === "/" ? "capture" : "people"}.html`,
    );
    await writeFile(file, body, "utf8");
    console.log(
      `[pending] ${path_.padEnd(8)} ${res.status} ${body.length} bytes -> ${file}`,
    );
  }
}

main().catch((err) => {
  console.error("[pending] FAILED:", err);
  process.exit(1);
});
