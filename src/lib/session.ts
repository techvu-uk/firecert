/** Session token helpers. Edge-safe (used by middleware), no database access here. */
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "fc_session";
export const SESSION_DAYS = 14;

export type SessionRole = "ADMIN" | "ENGINEER" | "CUSTOMER";
export type SessionPayload = { uid: string; role: SessionRole };

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ characters)");
  return new TextEncoder().encode(s);
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ role: p.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.uid)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const role = payload.role as SessionRole;
    if (!payload.sub || !["ADMIN", "ENGINEER", "CUSTOMER"].includes(role)) return null;
    return { uid: payload.sub, role };
  } catch {
    return null;
  }
}

export function homeFor(role: SessionRole): string {
  return role === "CUSTOMER" ? "/portal" : "/dashboard";
}
