import { NextResponse } from "next/server";
import { assertUser, STAFF } from "@/server/auth";
import { handle } from "@/server/api";
import { addPhoto, MAX_PHOTO_BYTES } from "@/server/services/certificates";

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await assertUser(STAFF);
  const { id } = await params;
  const form = await req.formData();
  const file = form.get("file");
  const field = String(form.get("field") ?? "");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: "Photo is too large (max 8 MB)" }, { status: 400 });
  const res = await addPhoto(user, id, field, new Uint8Array(await file.arrayBuffer()));
  return NextResponse.json(res);
});
