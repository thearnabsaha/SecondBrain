/* eslint-disable no-console */
/**
 * Quickest possible end-to-end chat test against the configured fallback chain.
 * Useful for ruling out "is Groq actually reachable AND does my key work AND
 * are my model names valid" all in one go.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
loadEnv({ path: path.join(root, ".env.local") });
loadEnv({ path: path.join(root, ".env") });

async function main() {
  // Dynamic imports so config.ts reads process.env AFTER dotenv has populated it.
  const { chat } = await import("../lib/llm/groq");
  const { config } = await import("../lib/config");

  console.log("\nSmoke chat test\n");
  console.log(`  models: ${config.groq.models.join(" -> ")}\n`);

  const t0 = Date.now();
  try {
    const out = await chat<string>({
      system: "You are a terse assistant. Reply with a single sentence.",
      user: "Say 'pong' and nothing else.",
      temperature: 0,
      maxTokens: 16,
    });
    console.log(`  OK in ${Date.now() - t0}ms`);
    console.log(`  reply: ${out.trim()}`);
  } catch (err) {
    console.log(`  FAIL in ${Date.now() - t0}ms`);
    console.log(`  ${(err as Error).message}`);
    process.exit(1);
  }
}

main();
