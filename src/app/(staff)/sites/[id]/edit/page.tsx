import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { SiteForm } from "@/components/forms/site-form";
import { saveSite } from "@/app/actions/customers";
import { ADMIN, requireUser } from "@/server/auth";
import { engineers, openVisitsBySite } from "@/server/queries";
import { getCompany } from "@/server/services/company";

export const metadata = { title: "Edit site" };

export default async function EditSite({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(ADMIN);
  const { id } = await params;
  const [s] = await db.select().from(sites).where(eq(sites.id, id));
  if (!s) notFound();
  const [engs, company, open] = await Promise.all([engineers(), getCompany(), openVisitsBySite([id])]);
  const openList = open.get(id) ?? [];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${s.name}`} back={{ href: `/sites/${id}`, label: s.name }} />
      <SiteForm
        action={saveSite.bind(null, s.customerId, id)}
        site={s}
        engineers={engs}
        defaultInterval={company.defaultServiceMonths}
        currentDue={openList.find((v) => v.serviceKind === "FIRE_ALARM")?.dueDate ?? null}
        currentElDue={openList.find((v) => v.serviceKind === "EMERGENCY_LIGHTING")?.dueDate ?? null}
      />
    </div>
  );
}
