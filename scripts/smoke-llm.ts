/* eslint-disable no-console */
/**
 * Quick end-to-end test of the Groq fallback chain. Hits the live API.
 * Run with: npx tsx scripts/smoke-llm.ts
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
loadEnv({ path: path.join(root, ".env.local") });
loadEnv({ path: path.join(root, ".env") });

async function main() {
  const { extractFromNote } = await import("../lib/llm/extract");
  const { config } = await import("../lib/config");

  console.log("[smoke] models in chain:", config.groq.models);
  const note =
    "Met Aarav at the gym. He works at TCS, doesn't smoke. His girlfriend Maya is a doctor.";
  console.log("[smoke] note:", note);

  const t0 = Date.now();
  const result = await extractFromNote(note, []);
  const ms = Date.now() - t0;
  console.log(`[smoke] succeeded in ${ms}ms`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("[smoke] FAILED:", err.message);
  process.exit(1);
});
