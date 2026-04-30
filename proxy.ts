import { NextRequest, NextResponse } from "next/server";
import { SESSION_CONFIG, verifySession } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/signin", "/signup"];

/**
 * Edge proxy (formerly middleware): gate every page behind a valid session
 * cookie except /signin and /signup. Static assets are excluded by the
 * matcher below.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  const token = req.cookies.get(SESSION_CONFIG.cookie)?.value;
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
