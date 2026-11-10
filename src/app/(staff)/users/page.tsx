import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Badge, Card, LinkButton, PageHeader, RowLink } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { formatUKDateTime } from "@/lib/dates";
import { ADMIN, requireUser } from "@/server/auth";

export const metadata = { title: "Staff" };

export default async function UsersPage() {
  await requireUser(ADMIN);
  const rows = await db.select().from(users).where(inArray(users.role, ["ADMIN", "ENGINEER"])).orderBy(asc(users.name));
  return (
    <>
      <PageHeader title="Staff" subtitle="Engineers and office users" actions={<LinkButton href="/users/new"><IconPlus /> Add staff</LinkButton>} />
      <Card>
        <div className="divide-y divide-ink-100">
          {rows.map((u) => (
            <RowLink key={u.id} href={`/users/${u.id}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-semibold">{u.name}</span>
                <div className="flex gap-1.5">
                  <Badge tone={u.role === "ADMIN" ? "info" : "neutral"}>{u.role === "ADMIN" ? "Admin" : "Engineer"}</Badge>
                  {!u.active ? <Badge>Inactive</Badge> : !u.passwordHash ? <Badge tone="warn">Invited</Badge> : null}
                </div>
              </div>
              <div className="truncate text-sm text-ink-500">
                {u.email}
                {u.lastLoginAt ? ` · last signed in ${formatUKDateTime(u.lastLoginAt)}` : ""}
              </div>
            </RowLink>
          ))}
        </div>
      </Card>
    </>
  );
}
