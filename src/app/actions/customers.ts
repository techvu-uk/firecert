"use server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { customers, sites, users, visits } from "@/db/schema";
import { fail, success, zodErrors, type ActionState } from "@/lib/action-state";
import { env } from "@/lib/env";
import { assertUser, createAuthToken, ADMIN, findUserByEmail } from "@/server/auth";
import { audit } from "@/server/audit";
import { notify } from "@/server/notify";
import { inviteMessage } from "@/server/notify/templates";
import { getCompany } from "@/server/services/company";
import { customerSchema, formToObject, portalUserSchema, siteSchema } from "@/server/validation";
import { addMonthsISO } from "@/lib/dates";
import { setNextServiceDue } from "@/server/services/scheduling";



export async function saveCustomer(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertUser(ADMIN);
  const parsed = customerSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fail("Please fix the highlighted fields", zodErrors(parsed.error.issues));
  const v = { ...parsed.data, accountRef: parsed.data.accountRef || null };

  if (v.accountRef) {
    const [clash] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.accountRef, v.accountRef), id ? sql`${customers.id} <> ${id}` : undefined));
    if (clash) return fail("Please fix the highlighted fields", { accountRef: "Another customer already uses this reference" });
  }

  let savedId = id;
  if (id) {
    await db.update(customers).set(v).where(eq(customers.id, id));
    await audit(db, user.id, "customer.updated", "customer", id);
  } else {
    const [c] = await db.insert(customers).values(v).returning({ id: customers.id });
    savedId = c.id;
    await audit(db, user.id, "customer.created", "customer", c.id);
  }
  revalidatePath("/customers");
  redirect(`/customers/${savedId}`);
}

export async function setCustomerArchived(id: string, archived: boolean) {
  const user = await assertUser(ADMIN);
  await db.update(customers).set({ archived }).where(eq(customers.id, id));
  await audit(db, user.id, archived ? "customer.archived" : "customer.restored", "customer", id);
  revalidatePath(`/customers/${id}`);
}

export async function invitePortalUser(customerId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await assertUser(ADMIN);
  const parsed = portalUserSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fail("Please fix the highlighted fields", zodErrors(parsed.error.issues));
  if (await findUserByEmail(parsed.data.email)) return fail("Please fix the highlighted fields", { email: "This email already has an account" });

  const [u] = await db
    .insert(users)
    .values({ name: parsed.data.name, email: parsed.data.email, role: "CUSTOMER", customerId })
    .returning();
  const link = await sendInvite(u.id, u.name, u.email, true);
  await audit(db, admin.id, "portal_user.invited", "user", u.id, { customerId });
  revalidatePath(`/customers/${customerId}`);
  return success(`Invitation sent to ${u.email}. You can also share this link with them directly:`, link);
}

export async function sendInvite(userId: string, name: string, email: string, portal: boolean) {
  const token = await createAuthToken(userId, "INVITE");
  const link = `${env.appUrl}/set-password/${token}`;
  const company = await getCompany();
  const msg = inviteMessage({ company: company.name, name, url: link, portal });
  await notify({ kind: "INVITE", channel: "email", message: { to: email, ...msg } });
  return link;
}

export async function resendInviteAction(userId: string, _: ActionState): Promise<ActionState> {
  await assertUser(ADMIN);
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) return fail("User not found");
  const link = await sendInvite(u.id, u.name, u.email, u.role === "CUSTOMER");
  return success(`New link sent to ${u.email}:`, link);
}

export async function setUserActive(userId: string, active: boolean, path: string) {
  const admin = await assertUser(ADMIN);
  if (userId === admin.id) throw new Error("You can't deactivate yourself");
  await db.update(users).set({ active }).where(eq(users.id, userId));
  await audit(db, admin.id, active ? "user.activated" : "user.deactivated", "user", userId);
  revalidatePath(path);
}

// ---- Sites -------------------------------------------------------------------
export async function saveSite(customerId: string, siteId: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertUser(ADMIN);
  const parsed = siteSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fail("Please fix the highlighted fields", zodErrors(parsed.error.issues));
  const { nextServiceDue, nextElDue, ...v } = parsed.data;
  const values = { ...v, assignedEngineerId: v.assignedEngineerId || null };

  const id = await db.transaction(async (tx) => {
    let site;
    if (siteId) {
      const [before] = await tx.select().from(sites).where(eq(sites.id, siteId)).for("update");
      [site] = await tx.update(sites).set(values).where(eq(sites.id, siteId)).returning();
      // If the interval changed, move the open (unbooked) due date to match
      if (!nextServiceDue && before.serviceIntervalMonths !== site.serviceIntervalMonths && site.lastServiceDate) {
        const [open] = await tx
          .select()
          .from(visits)
          .where(and(eq(visits.siteId, site.id), eq(visits.type, "SERVICE"), eq(visits.serviceKind, "FIRE_ALARM"), eq(visits.status, "DUE")));
        if (open) await setNextServiceDue(tx, site, addMonthsISO(site.lastServiceDate, site.serviceIntervalMonths));
      }
      // Keep the engineer on the open visit in step with the site's assigned engineer
      if (before.assignedEngineerId !== site.assignedEngineerId) {
        await tx
          .update(visits)
          .set({ engineerId: site.assignedEngineerId })
          .where(and(eq(visits.siteId, site.id), eq(visits.status, "DUE")));
      }
      await audit(tx, user.id, "site.updated", "site", site.id);
    } else {
      [site] = await tx.insert(sites).values({ ...values, customerId }).returning();
      await audit(tx, user.id, "site.created", "site", site.id);
    }
    if (nextServiceDue) await setNextServiceDue(tx, site, nextServiceDue, "FIRE_ALARM");
    if (nextElDue) await setNextServiceDue(tx, site, nextElDue, "EMERGENCY_LIGHTING");
    return site.id;
  });
  revalidatePath(`/customers/${customerId}`);
  redirect(`/sites/${id}`);
}

export async function setSiteArchived(siteId: string, archived: boolean) {
  const user = await assertUser(ADMIN);
  await db.transaction(async (tx) => {
    await tx.update(sites).set({ archived }).where(eq(sites.id, siteId));
    if (archived) {
      // Stop reminders for archived sites
      await tx
        .update(visits)
        .set({ status: "CANCELLED", notes: "Site archived" })
        .where(and(eq(visits.siteId, siteId), inArray(visits.status, ["DUE", "BOOKED"])));
    }
    await audit(tx, user.id, archived ? "site.archived" : "site.restored", "site", siteId);
  });
  revalidatePath(`/sites/${siteId}`);
}
