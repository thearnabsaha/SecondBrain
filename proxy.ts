import { NextRequest, NextResponse } from "next/server";
import { SESSION_CONFIG, verifySession } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/signin", "/signup"];

// Browsers and the Next.js dev tooling probe these paths constantly; serving
// a 404 immediately is ~40x cheaper than running JWT verify + a redirect for
// each one. The matcher below already excludes most static assets, but a few
// (sw.js, manifest.webmanifest) are page-relative so they slip through.
const SHORT_CIRCUIT_PATHS = new Set([
  "/sw.js",
  "/service-worker.js",
  "/manifest.webmanifest",
  "/manifest.json",
]);

/**
 * Edge proxy (formerly middleware): gate every page behind a valid session
 * cookie except /signin and /signup. Static assets are excluded by the
 * matcher below.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (SHORT_CIRCUIT_PATHS.has(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const token = req.cookies.get(SESSION_CONFIG.cookie)?.value;
  // Skip JWT verify entirely when the route is public AND no cookie is
  // present — the only thing verify could affect there is the
  // already-signed-in redirect, which doesn't apply.
  const session = token ? await verifySession(token) : null;

  if (isPublic) {
    if (session) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const url = new URL("/signin", req.url);
    if (pathname !== "/") url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[^/]+$).*)",
  ],
};
