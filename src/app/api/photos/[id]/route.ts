import { NextResponse } from "next/server";
import { assertUser } from "@/server/auth";
import { handle } from "@/server/api";
import { getPhoto } from "@/server/services/certificates";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await assertUser(["ADMIN", "ENGINEER", "CUSTOMER"]);
  const { id } = await params;
  const photo = await getPhoto(user, id);
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new Response(Buffer.from(photo.bytes), {
    headers: { "Content-Type": photo.mimeType, "Cache-Control": "private, max-age=86400" },
  });
});
