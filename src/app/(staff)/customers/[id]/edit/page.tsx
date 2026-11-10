import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "@/components/forms/customer-form";
import { saveCustomer } from "@/app/actions/customers";
import { ADMIN, requireUser } from "@/server/auth";

export const metadata = { title: "Edit customer" };

export default async function EditCustomer({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(ADMIN);
  const { id } = await params;
  const [c] = await db.select().from(customers).where(eq(customers.id, id));
  if (!c) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${c.name}`} back={{ href: `/customers/${id}`, label: c.name }} />
      <CustomerForm action={saveCustomer.bind(null, id)} customer={c} />
    </div>
  );
}
