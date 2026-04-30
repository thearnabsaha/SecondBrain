import { SignJWT, jwtVerify } from "jose";

const SESSION_COOKIE = "sb_session";
const SESSION_DURATION_SEC = 60 * 60 * 24 * 30; // 30 days

interface SessionPayload {
  uid: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is not set or is too short. Generate one with `openssl rand -base64 48` and add to .env.local.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SEC}s`)
    .sign(getSecretKey());
}

export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.uid !== "string") return null;
    return { uid: payload.uid };
  } catch {
    return null;
  }
}

export const SESSION_CONFIG = {
  cookie: SESSION_COOKIE,
  maxAge: SESSION_DURATION_SEC,
} as const;
