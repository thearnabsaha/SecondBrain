/* eslint-disable no-console */
/**
 * Post-process the smoke-test HTML dumps so they render correctly when
 * opened directly from disk (file://) by injecting a <base> tag pointing
 * at the running dev server. Then write a single index.html that
 * iframes every page for easy review.
 *
 * Run AFTER `tsx scripts/smoke-e2e.ts` while the dev server is still up.
 */
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "_smoke_out");
const baseHref = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

async function main() {
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(outDir)).filter(
    (f) => f.endsWith(".html") && f !== "index.html",
  );
  files.sort();

  for (const file of files) {
    const fp = path.join(outDir, file);
    const html = await readFile(fp, "utf8");
    // Inject <base> immediately after <head>. If <head> is missing
    // (shouldn't happen with Next), fall back to start of body.
    const baseTag = `<base href="${baseHref}/" target="_top">`;
    let patched: string;
    if (/<head[^>]*>/i.test(html)) {
      patched = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    } else {
      patched = baseTag + html;
    }
    const live = file.replace(/\.html$/, ".live.html");
    await writeFile(path.join(outDir, live), patched, "utf8");
    console.log(`[bundle] wrote ${live}`);
  }
}

main().catch((err) => {
  console.error("[bundle] FAILED:", err);
  process.exit(1);
});
