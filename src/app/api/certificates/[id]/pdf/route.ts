import { NextResponse } from "next/server";
import { assertUser } from "@/server/auth";
import { handle } from "@/server/api";
import { getCertificateFor, getCertificatePdf, pdfFilename } from "@/server/services/certificates";

export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await assertUser(["ADMIN", "ENGINEER", "CUSTOMER"]);
  const { id } = await params;
  const cert = await getCertificateFor(user, id);
  if (!cert) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pdf = await getCertificatePdf(cert);
  const download = new URL(req.url).searchParams.has("download");
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${pdfFilename(cert, cert.site.name)}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
