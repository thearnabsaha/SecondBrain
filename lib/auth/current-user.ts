import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserById } from "../repos/usersRepo";
import type { User } from "../types";
import { SESSION_CONFIG, verifySession } from "./session";

/**
 * Returns the currently signed-in user, or null. Reads the session cookie,
 * verifies the JWT, and looks the user up in Postgres.
 *
 * Wrapped in React's cache() so that within a single request the layout,
 * the page, and any nested server component all share one DB hit + one JWT
 * verify, instead of repeating the work each time.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_CONFIG.cookie)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  return findUserById(payload.uid);
});

/**
 * Same as getCurrentUser but redirects to /signin if not authenticated.
 * Throws (via redirect) so callers don't need to null-check.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return user;
}
