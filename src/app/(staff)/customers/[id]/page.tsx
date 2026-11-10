import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { customers, sites, users } from "@/db/schema";
import { Alert, Badge, Button, Card, CardHeader, DetailList, EmptyState, LinkButton, PageHeader, RowLink } from "@/components/ui";
import { ActionForm, FormGrid, Input, SubmitButton } from "@/components/form";
import { DueBadge, formTitle, OutcomeBadge } from "@/components/status";
import { IconEdit, IconPlus } from "@/components/icons";
import { formatUK } from "@/lib/dates";
import { requireUser, STAFF } from "@/server/auth";
import { certificateRows, openVisitsBySite } from "@/server/queries";
import { invitePortalUser, resendInviteAction, setCustomerArchived, setUserActive } from "@/app/actions/customers";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(STAFF);
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;
  const [c] = await db.select().from(customers).where(eq(customers.id, id));
  if (!c) notFound();

  const [siteRows, portalUsers, certs] = await Promise.all([
    db.select().from(sites).where(and(eq(sites.customerId, id))).orderBy(asc(sites.archived), asc(sites.name)),
    db.select().from(users).where(and(eq(users.customerId, id), eq(users.role, "CUSTOMER"))).orderBy(asc(users.name)),
    certificateRows({ customerId: id, status: "ISSUED", limit: 10 }),
  ]);
  const due = await openVisitsBySite(siteRows.map((s) => s.id));
  const channels = [c.notifyEmail && "Email", c.notifySms && "SMS", c.notifyWhatsapp && "WhatsApp"].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={c.archived ? <Badge>Archived</Badge> : c.accountRef ? `Ref ${c.accountRef}` : undefined}
        back={{ href: "/customers", label: "Customers" }}
        actions={
          isAdmin && (
            <>
              <LinkButton href={`/customers/${id}/edit`} variant="secondary">
                <IconEdit /> Edit
              </LinkButton>
              <LinkButton href={`/sites/new?customerId=${id}`}>
                <IconPlus /> Add site
              </LinkButton>
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Sites" subtitle={`${siteRows.filter((s) => !s.archived).length} active`} />
            {siteRows.length === 0 ? (
              <EmptyState
                title="No sites yet"
                body="Add the premises where this customer's fire alarm systems are installed."
                action={isAdmin && <LinkButton href={`/sites/new?customerId=${id}`}>Add site</LinkButton>}
              />
            ) : (
              <div className="divide-y divide-ink-100">
                {siteRows.map((s) => {
                  const v = due.get(s.id)?.[0];
                  return (
                    <RowLink key={s.id} href={`/sites/${s.id}`} className={s.archived ? "opacity-60" : undefined}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{s.name}</span>
                        {s.archived ? <Badge>Archived</Badge> : v ? <DueBadge dueDate={v.dueDate} status={v.status} /> : <Badge>Not scheduled</Badge>}
                      </div>
                      <div className="truncate text-sm text-ink-500">
                        {s.postcode} · {s.systemCategory || "Category not set"} · every {s.serviceIntervalMonths} months
                      </div>
                    </RowLink>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Recent certificates" />
            {certs.length === 0 ? (
              <EmptyState title="No certificates issued yet" />
            ) : (
              <div className="divide-y divide-ink-100">
                {certs.map((r) => (
                  <RowLink key={r.cert.id} href={`/certificates/${r.cert.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{r.cert.number}</span>
                      <OutcomeBadge formId={r.cert.formId} formVersion={r.cert.formVersion} outcome={r.cert.outcome} />
                    </div>
                    <div className="truncate text-sm text-ink-500">
                      {formTitle(r.cert.formId, r.cert.formVersion)} · {r.site.name} · {formatUK(r.cert.issuedAt)}
                    </div>
                  </RowLink>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Contact" />
            <DetailList
              items={[
                { label: "Name", value: c.contactName },
                { label: "Email", value: c.contactEmail },
                { label: "Phone", value: c.contactPhone },
                { label: "Address", value: [c.addressLines, c.postcode].filter(Boolean).join("\n") },
                { label: "Reminders", value: channels || "Off" },
                ...(c.notes ? [{ label: "Notes", value: c.notes }] : []),
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Customer portal" subtitle="People who can log in to download certificates" />
            <div className="divide-y divide-ink-100">
              {portalUsers.map((u) => (
                <div key={u.id} className="space-y-2 px-4 py-3 sm:px-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{u.name}</div>
                      <div className="truncate text-xs text-ink-500">{u.email}</div>
                    </div>
                    {!u.active ? <Badge>Disabled</Badge> : u.passwordHash ? <Badge tone="good">Active</Badge> : <Badge tone="warn">Invited</Badge>}
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap gap-2">
                      {u.active && (
                        <ActionForm action={resendInviteAction.bind(null, u.id)} className="space-y-2">
                          <SubmitButton variant="secondary" className="h-8 px-3 text-xs">
                            {u.passwordHash ? "Send password reset" : "Resend invite"}
                          </SubmitButton>
                        </ActionForm>
                      )}
                      <form action={setUserActive.bind(null, u.id, !u.active, `/customers/${id}`)}>
                        <Button variant="ghost" className="h-8 px-3 text-xs">{u.active ? "Disable" : "Enable"}</Button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {isAdmin && (
              <div className="border-t border-ink-100 p-4 sm:p-5">
                <ActionForm action={invitePortalUser.bind(null, id)} resetOnSuccess>
                  <FormGrid>
                    <Input name="name" label="Name" required />
                    <Input name="email" label="Email" type="email" required />
                  </FormGrid>
                  <SubmitButton variant="secondary">Invite to portal</SubmitButton>
                </ActionForm>
              </div>
            )}
          </Card>

          {isAdmin && (
            <form action={setCustomerArchived.bind(null, id, !c.archived)}>
              {!c.archived && (
                <div className="mb-2">
                  <Alert tone="info">Archiving hides the customer from lists. Their certificates are kept.</Alert>
                </div>
              )}
              <Button variant="danger" className="w-full">{c.archived ? "Restore customer" : "Archive customer"}</Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
