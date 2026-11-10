"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { companySettings, users } from "@/db/schema";
import { fail, success, zodErrors, type ActionState } from "@/lib/action-state";
import { ADMIN, assertUser } from "@/server/auth";
import { audit } from "@/server/audit";
import { formToObject, settingsSchema, userSchema } from "@/server/validation";
import { sendInvite } from "./customers";

export async function saveStaffUser(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await assertUser(ADMIN);
  const parsed = userSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fail("Please fix the highlighted fields", zodErrors(parsed.error.issues));
  const v = parsed.data;

  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${v.email}`, id ? sql`${users.id} <> ${id}` : undefined));
  if (clash) return fail("Please fix the highlighted fields", { email: "Another account already uses this email" });

  if (id) {
    if (id === admin.id && (!v.active || v.role !== "ADMIN")) return fail("You can't remove your own admin access or deactivate yourself");
    await db.update(users).set(v).where(eq(users.id, id));
    await audit(db, admin.id, "user.updated", "user", id);
    revalidatePath("/users");
    return success("Saved");
  }
  const [u] = await db.insert(users).values(v).returning();
  await audit(db, admin.id, "user.created", "user", u.id);
  await sendInvite(u.id, u.name, u.email, false);
  redirect(`/users/${u.id}?invited=1`);
}

export async function saveSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await assertUser(ADMIN);
  const parsed = settingsSchema.safeParse(formToObject(fd));
  if (!parsed.success) return fail("Please fix the highlighted fields", zodErrors(parsed.error.issues));
  await db
    .insert(companySettings)
    .values({ id: "company", ...parsed.data })
    .onConflictDoUpdate({ target: companySettings.id, set: parsed.data });
  await audit(db, admin.id, "settings.updated", "settings", "company");
  revalidatePath("/settings");
  return success("Settings saved. New certificates will use these details.");
}
