import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { visits } from "@/db/schema";
import { Alert, Button, Card, PageHeader } from "@/components/ui";
import { ActionForm, Checkbox, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { DueBadge } from "@/components/status";
import { dateToUkLocal, formatUK, formatUKDateTime } from "@/lib/dates";
import { oneLine } from "@/lib/utils";
import { serviceKind } from "@/lib/service-kinds";
import { ADMIN, requireUser } from "@/server/auth";
import { engineers } from "@/server/queries";
import { bookVisitAction, unbookVisitAction } from "@/app/actions/schedule";

export const metadata = { title: "Book visit" };

export default async function BookVisitPage({ params }: { params: Promise<{ visitId: string }> }) {
  await requireUser(ADMIN);
  const { visitId } = await params;
  const visit = await db.query.visits.findFirst({ where: eq(visits.id, visitId), with: { site: { with: { customer: true } } } });
  if (!visit) notFound();
  const engs = await engineers();
  const closed = visit.status === "COMPLETED" || visit.status === "CANCELLED";
  const s = visit.site;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={`${visit.status === "BOOKED" ? "Change booking" : "Book visit"}: ${serviceKind(visit.serviceKind).serviceTitle}`}
        subtitle={`${s.name} · ${s.customer.name}`}
        back={{ href: `/sites/${s.id}`, label: s.name }}
      />
      <Card className="mb-4 flex items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="text-sm text-ink-500">Service due</div>
          <div className="text-lg font-bold">{formatUK(visit.dueDate)}</div>
          <div className="truncate text-sm text-ink-500">{oneLine(s.addressLines, s.postcode)}</div>
        </div>
        <DueBadge dueDate={visit.dueDate} status={visit.status} />
      </Card>
      {closed ? (
        <Alert tone="info">This visit is {visit.status.toLowerCase()}.</Alert>
      ) : (
        <Card className="p-4 sm:p-6">
          <ActionForm action={bookVisitAction.bind(null, visit.id, s.id)}>
            <FormGrid>
              <Input name="bookedFor" label="Date and time" type="datetime-local" required defaultValue={dateToUkLocal(visit.bookedFor)} />
              <Select
                name="engineerId"
                label="Engineer"
                defaultValue={visit.engineerId ?? s.assignedEngineerId ?? ""}
                placeholder="Unassigned"
                options={engs.map((e) => ({ value: e.id, label: e.name }))}
              />
            </FormGrid>
            <Textarea name="notes" label="Notes for engineer" defaultValue={visit.notes} />
            <Checkbox name="notify" label="Send booking confirmation to the customer" defaultChecked />
            <div className="flex justify-end">
              <SubmitButton>{visit.status === "BOOKED" ? "Update booking" : "Book visit"}</SubmitButton>
            </div>
          </ActionForm>
          {visit.status === "BOOKED" && (
            <form action={unbookVisitAction.bind(null, visit.id)} className="mt-4 border-t border-ink-100 pt-4">
              <p className="mb-2 text-sm text-ink-500">Currently booked for {formatUKDateTime(visit.bookedFor)}.</p>
              <Button variant="danger">Cancel booking</Button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
