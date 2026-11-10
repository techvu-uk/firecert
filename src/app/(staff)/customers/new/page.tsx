import { PageHeader } from "@/components/ui";
import { CustomerForm } from "@/components/forms/customer-form";
import { saveCustomer } from "@/app/actions/customers";
import { ADMIN, requireUser } from "@/server/auth";

export const metadata = { title: "New customer" };

export default async function NewCustomer() {
  await requireUser(ADMIN);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New customer" back={{ href: "/customers", label: "Customers" }} />
      <CustomerForm action={saveCustomer.bind(null, null)} />
    </div>
  );
}
