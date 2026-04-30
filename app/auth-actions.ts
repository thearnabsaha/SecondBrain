"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureSchema } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_CONFIG, signSession } from "@/lib/auth/session";
import {
  createUser,
  findUserByEmail,
} from "@/lib/repos/usersRepo";

export type AuthFormState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function setSessionCookie(userId: string): Promise<void> {
  const token = await signSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_CONFIG.cookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_CONFIG.maxAge,
  });
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;

  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  try {
    await ensureSchema();
    const existing = await findUserByEmail(email);
    if (existing) {
      return {
        ok: false,
        error: "An account with that email already exists. Try signing in.",
      };
    }
    const hash = await hashPassword(password);
    const user = await createUser(email, hash, name);
    await setSessionCookie(user.id);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  redirect("/");
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  try {
    await ensureSchema();
    const found = await findUserByEmail(email);
    if (!found) {
      return { ok: false, error: "Invalid email or password." };
    }
    const ok = await verifyPassword(password, found.password_hash);
    if (!ok) {
      return { ok: false, error: "Invalid email or password." };
    }
    await setSessionCookie(found.user.id);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  redirect("/");
}

export async function signOutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_CONFIG.cookie);
  redirect("/signin");
}
