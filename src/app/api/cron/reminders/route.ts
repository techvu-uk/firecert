import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { runReminders } from "@/server/services/reminders";

export const dynamic = "force-dynamic";

/** Daily reminder job. Call with header `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(req: Request) {
  const secret = env.cronSecret;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok = secret.length >= 8 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const result = await runReminders();
  return NextResponse.json(result);
}
