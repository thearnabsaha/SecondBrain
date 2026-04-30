/* eslint-disable no-console */
import "dotenv/config";
import { applySchema } from "../lib/db/schema";
import { hasPostgres } from "../lib/config";

async function main() {
  if (!hasPostgres()) {
    console.error(
      "POSTGRES_URL is not set. Add it to .env (or run `vercel env pull .env`).",
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
