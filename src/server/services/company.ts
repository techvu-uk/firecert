import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companySettings, type CompanySettings } from "@/db/schema";

export async function getCompany(): Promise<CompanySettings> {
  const [row] = await db.select().from(companySettings).where(eq(companySettings.id, "company")).limit(1);
  if (row) return row;
  const [created] = await db.insert(companySettings).values({ id: "company" }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(companySettings).limit(1))[0];
}
