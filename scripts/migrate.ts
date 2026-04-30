/* eslint-disable no-console */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load env BEFORE importing anything that touches process.env.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
loadEnv({ path: path.join(root, ".env.local") });
loadEnv({ path: path.join(root, ".env") });

async function main() {
  const { applySchema } = await import("../lib/db/schema");
  const { hasPostgres } = await import("../lib/config");

  if (!hasPostgres()) {
    console.error(
      "POSTGRES_URL is not set. Add it to .env.local before running this.",
    );
    process.exit(1);
  }
  console.log("[migrate] applying schema…");
  await applySchema();
  console.log("[migrate] done.");
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
