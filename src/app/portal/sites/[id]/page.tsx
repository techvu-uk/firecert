import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { Card, CardHeader, DetailList, EmptyState, PageHeader } from "@/components/ui";
import { PortalCertList } from "@/components/portal-cert-list";
import { formatUK, formatUKDateTime } from "@/lib/dates";
import { requireUser } from "@/server/auth";
import { certificateRows, openVisitsBySite } from "@/server/queries";
import { serviceKind } from "@/lib/service-kinds";

export default async function PortalSite({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["CUSTOMER"]);
  const { id } = await params;
  const [site] = await db.select().from(sites).where(and(eq(sites.id, id), eq(sites.customerId, user.customerId!)));
  if (!site) notFound();
  const [certs, due] = await Promise.all([certificateRows({ siteId: id, status: "ISSUED", limit: 200 }), openVisitsBySite([id])]);
  const vs = due.get(id) ?? [];
  return (
    <>
      <PageHeader title={site.name} back={{ href: "/portal", label: "My sites" }} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Certificates" subtitle={`${certs.length} issued`} />
            {certs.length === 0 ? <EmptyState title="No certificates yet" /> : <PortalCertList rows={certs} showSite={false} />}
          </Card>
        </div>
        <Card>
          <CardHeader title="Servicing" />
          <DetailList
            items={[
              ...(vs.length
                ? vs.map((v) => ({
                    label: serviceKind(v.serviceKind).serviceTitle,
                    value: `Due ${formatUK(v.dueDate)}${v.bookedFor ? `\nBooked ${formatUKDateTime(v.bookedFor)}` : ""}`,
                  }))
                : [{ label: "Next service", value: "Not scheduled" }]),
              { label: "Last fire alarm service", value: site.lastServiceDate ? formatUK(site.lastServiceDate) : "" },
              { label: "System", value: [site.systemCategory, site.systemType, site.panelMake].filter(Boolean).join(" · ") },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
