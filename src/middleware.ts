/**
 * First line of access control: redirects signed-out users to /login and keeps customers
 * out of staff pages (and vice versa). Every page and action ALSO checks permissions on
 * the server (see src/server/auth.ts) — this is a convenience layer, not the only check.
 */
import { NextResponse, type NextRequest } from "next/server";
import { homeFor, SESSION_COOKIE, verifySession } from "@/lib/session";

const PUBLIC = ["/api/health", "/login", "/forgot", "/set-password", "/api/cron", "/manifest.webmanifest", "/sw.js", "/icons", "/offline"];
const STAFF_ONLY = ["/dashboard", "/customers", "/sites", "/schedule", "/certificates", "/users", "/settings", "/notifications"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname === "/") return NextResponse.redirect(new URL(homeFor(session.role), req.url));
  const isStaffPage = STAFF_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isStaffPage && session.role === "CUSTOMER") return NextResponse.redirect(new URL("/portal", req.url));
  if (pathname.startsWith("/portal") && session.role !== "CUSTOMER")
    return NextResponse.redirect(new URL("/dashboard", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|jpg|webp)$).*)"],
};
