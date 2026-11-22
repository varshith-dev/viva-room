import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

const COOKIE = "viva_session";

// When AUTH_SECRET is missing in production (a fresh one-click deploy), derive a stable secret
// from the database URL, which only the project owner has. Set AUTH_SECRET for real use.
const secret = () => {
  let v = process.env.AUTH_SECRET;
  if (!v && process.env.NODE_ENV === "production") {
    const base = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!base) throw new Error("Set AUTH_SECRET or DATABASE_URL");
    v = createHash("sha256").update(`${base}|viva-room-auth-v1`).digest("hex");
  }
  return new TextEncoder().encode(v ?? "dev-only-secret-0000000000000000000000");
};

export type SessionUser = { id: string; email: string; name: string };

export async function signIn(user: SessionUser) {
  const token = await new SignJWT({ id: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 14 * 86400,
  });
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const u = await db.user.findUnique({ where: { id: String(payload.id) } });
    return u ? { id: u.id, email: u.email, name: u.name } : null;
  } catch (e) {
    if (process.env.DEBUG_AUTH) console.error("auth", e);
    return null;
  }
}

export async function requireUser(next = "/app"): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiUser(): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Please sign in first.");
  return u;
}

export function fail(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  const msg = e instanceof Error ? e.message : "Something went wrong.";
  return Response.json({ error: msg }, { status: 500 });
}
