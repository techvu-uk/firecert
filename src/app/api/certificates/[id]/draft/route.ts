import { NextResponse } from "next/server";
import { assertUser, STAFF } from "@/server/auth";
import { handle } from "@/server/api";
import { saveDraft } from "@/server/services/certificates";

export const PUT = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await assertUser(STAFF);
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { data?: unknown } | null;
  if (!body || typeof body.data !== "object" || body.data === null || Array.isArray(body.data))
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  const res = await saveDraft(user, id, body.data as Record<string, unknown>);
  return NextResponse.json({ ok: true, errors: res.errors, updatedAt: res.updatedAt });
});
