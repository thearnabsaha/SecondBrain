import { NextResponse } from "next/server";
import { ensureSchema } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import {
  bundleToMarkdown,
  exportUserBundle,
} from "@/lib/services/exportService";

export const dynamic = "force-dynamic";

/**
 * Download the signed-in user's whole graph.
 *
 *   GET /api/export?format=json    -> JSON bundle (default)
 *   GET /api/export?format=md      -> single Markdown document
 *
 * Auth: piggybacks on the existing session cookie via requireUser().
 * Edge proxy already gates the route group, so an unauthenticated
 * request would be redirected before reaching here, but requireUser()
 * defends in depth.
 */
export async function GET(req: Request) {
  await ensureSchema();
  const user = await requireUser();

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();

  const bundle = await exportUserBundle(user);

  const stamp = new Date().toISOString().slice(0, 10);
  const safeEmail = user.email.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  if (format === "md" || format === "markdown") {
    const body = bundleToMarkdown(bundle);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="secondbrain-${safeEmail}-${stamp}.md"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // Default: JSON.
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="secondbrain-${safeEmail}-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
