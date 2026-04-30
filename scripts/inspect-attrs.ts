/* eslint-disable no-console */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "..", ".env.local") });

async function main() {
  const { sql } = await import("../lib/db/index");
  const rows = await sql`
    SELECT category, key, value, COUNT(*) AS n
      FROM attributes
     WHERE superseded_by IS NULL
     GROUP BY category, key, value
     ORDER BY category, key, value
  `;
  console.log(JSON.stringify(rows, null, 2));
  console.log("\n--- people ---");
  const people = await sql`SELECT id, name FROM people ORDER BY name`;
  console.log(JSON.stringify(people, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
