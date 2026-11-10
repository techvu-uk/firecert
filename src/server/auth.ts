import "server-only";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { db } from "@/db";
import { authTokens, users, type Role, type User } from "@/db/schema";
import { SESSION_COOKIE, SESSION_DAYS, signSession, verifySession } from "@/lib/session";

export class AuthError extends Error {}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters";
  if (pw.length > 200) return "Password is too long";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password must include letters and numbers";
  return null;
}

export async function findUserByEmail(email: string) {
  const [u] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
    .limit(1);
  return u ?? null;
}

// ---- Login rate limiting (per email + IP, in memory) -------------------------
const attempts = new Map<string, { count: number; until: number }>();
export function loginThrottled(key: string): boolean {
  const a = attempts.get(key);
  return !!a && a.count >= 5 && a.until > Date.now();
}
export function recordLoginFailure(key: string) {
  const a = attempts.get(key);
  const fresh = !a || a.until < Date.now();
  attempts.set(key, { count: fresh ? 1 : a!.count + 1, until: Date.now() + 15 * 60_000 });
}
export function clearLoginFailures(key: string) {
  attempts.delete(key);
}

let dummyHash: string | undefined;
export async function verifyLogin(email: string, password: string): Promise<User | null> {
  const user = await findUserByEmail(email);
  // Always run bcrypt to avoid revealing which emails exist via timing
  dummyHash ??= await bcrypt.hash("not-a-real-password", 12);
  const hash = user?.passwordHash ?? dummyHash;
  const ok = await bcrypt.compare(password, hash);
  if (!user || !user.active || !user.passwordHash || !ok) return null;
  return user;
}

export async function startSession(user: User) {
  const token = await signSession({ uid: user.id, role: user.role });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Current signed-in, active user (or null). Cached per request. */
export const currentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const [u] = await db.select().from(users).where(eq(users.id, session.uid)).limit(1);
  if (!u || !u.active || u.role !== session.role) return null;
  return u;
});

/** For pages: redirects to login (or the right area) if the user may not view it. */
export async function requireUser(roles: Role[]): Promise<User> {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (!roles.includes(u.role)) redirect(u.role === "CUSTOMER" ? "/portal" : "/dashboard");
  return u;
}

/** For server actions and API routes: throws instead of redirecting. */
export async function assertUser(roles: Role[]): Promise<User> {
  const u = await currentUser();
  if (!u) throw new AuthError("Not signed in");
  if (!roles.includes(u.role)) throw new AuthError("You don't have permission to do that");
  return u;
}

export const STAFF: Role[] = ["ADMIN", "ENGINEER"];
export const ADMIN: Role[] = ["ADMIN"];

// ---- Invite / password reset tokens -------------------------------------------
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createAuthToken(userId: string, type: "INVITE" | "RESET"): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  const hours = type === "INVITE" ? 24 * 7 : 2;
  await db.insert(authTokens).values({
    userId,
    type,
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + hours * 3600_000),
  });
  return raw;
}

export async function findValidToken(raw: string) {
  const [t] = await db
    .select({ token: authTokens, user: users })
    .from(authTokens)
    .innerJoin(users, eq(users.id, authTokens.userId))
    .where(and(eq(authTokens.tokenHash, sha256(raw)), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
    .limit(1);
  return t ?? null;
}

export async function consumeTokenAndSetPassword(raw: string, password: string): Promise<User> {
  return db.transaction(async (tx) => {
    const [t] = await tx
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(authTokens.tokenHash, sha256(raw)), isNull(authTokens.usedAt), gt(authTokens.expiresAt, new Date())))
      .returning();
    if (!t) throw new AuthError("This link has expired or has already been used.");
    const [u] = await tx
      .update(users)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(users.id, t.userId))
      .returning();
    return u;
  });
}
