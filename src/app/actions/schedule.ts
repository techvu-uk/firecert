"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, type ActionState } from "@/lib/action-state";
import { ukLocalToDate } from "@/lib/dates";
import { ADMIN, assertUser } from "@/server/auth";
import { bookVisit, unbookVisit } from "@/server/services/scheduling";

export async function bookVisitAction(visitId: string, siteId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertUser(ADMIN);
  const when = ukLocalToDate(String(fd.get("bookedFor") ?? ""));
  if (!when) return fail("Please fix the highlighted fields", { bookedFor: "Choose a date and time" });
  if (when.getTime() < Date.now() - 86400_000) return fail("Please fix the highlighted fields", { bookedFor: "Date is in the past" });
  const engineerId = String(fd.get("engineerId") ?? "") || null;
  const notes = String(fd.get("notes") ?? "").slice(0, 2000);
  const sendNotice = fd.get("notify") === "on";
  try {
    await bookVisit(user.id, visitId, when, engineerId, notes, sendNotice);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't book the visit");
  }
  revalidatePath("/schedule");
  redirect(`/sites/${siteId}`);
}

export async function unbookVisitAction(visitId: string) {
  const user = await assertUser(ADMIN);
  await unbookVisit(user.id, visitId);
  revalidatePath("/schedule");
  revalidatePath(`/schedule/${visitId}`);
}
