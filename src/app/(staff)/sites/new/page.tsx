import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { SiteForm } from "@/components/forms/site-form";
import { saveSite } from "@/app/actions/customers";
import { ADMIN, requireUser } from "@/server/auth";
import { engineers } from "@/server/queries";
import { getCompany } from "@/server/services/company";

export const metadata = { title: "New site" };

export default async function NewSite({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  await requireUser(ADMIN);
  const { customerId } = await searchParams;
  if (!customerId) notFound();
  const [c] = await db.select().from(customers).where(eq(customers.id, customerId));
  if (!c) notFound();
  const [engs, company] = await Promise.all([engineers(), getCompany()]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New site" subtitle={c.name} back={{ href: `/customers/${c.id}`, label: c.name }} />
      <SiteForm action={saveSite.bind(null, c.id, null)} engineers={engs} defaultInterval={company.defaultServiceMonths} />
    </div>
  );
}
