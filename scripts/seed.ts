/**
 * Sets up the database for first use.
 *
 *   npm run db:seed -- --admin you@company.co.uk "Your Name"   create the first admin (prints a set-password link)
 *   npm run db:seed -- --demo                                  load demo data for trying the app (NOT for production)
 */
import "./load-env";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { addMonthsISO, todayISO } from "../src/lib/dates";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
const { authTokens, companySettings, customers, sites, users, visits } = schema;

async function createAdmin(email: string, name: string) {
  const [u] = await db
    .insert(users)
    .values({ email: email.toLowerCase(), name, role: "ADMIN" })
    .onConflictDoNothing()
    .returning();
  if (!u) {
    console.log(`A user with email ${email} already exists.`);
    return;
  }
  const raw = randomBytes(32).toString("base64url");
  await db.insert(authTokens).values({
    userId: u.id,
    type: "INVITE",
    tokenHash: createHash("sha256").update(raw).digest("hex"),
    expiresAt: new Date(Date.now() + 7 * 86400_000),
  });
  const url = `${(process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000").replace(/\/$/, "")}/set-password/${raw}`;
  console.log(`\nAdmin created: ${email}\nOpen this link to set your password (valid 7 days):\n\n  ${url}\n`);
}

async function demo() {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(customers);
  if (Number(n) > 0) {
    console.log("Database already has customers – skipping demo data.");
    return;
  }
  const hash = await bcrypt.hash("Demo12345!", 12);
  await db
    .insert(companySettings)
    .values({
      id: "company",
      name: "Techvu Ltd",
      tagline: "Your Gate to Technology",
      addressLines: "30 Harman Court, Rectory Park Avenue, Northolt, UB5 6SS",
      phone: "020 4615 3656",
      mobile: "07491 391228",
      email: "info@techvu.co.uk",
      website: "www.techvu.co.uk",
      companyRegNo: "16940054",
      certPrefix: "TV",
    })
    .onConflictDoNothing();

  const [admin, eng1, eng2] = await db
    .insert(users)
    .values([
      { email: "admin@demo.test", name: "Office Admin", role: "ADMIN", passwordHash: hash, position: "Service Manager" },
      { email: "engineer@demo.test", name: "Sam Carter", role: "ENGINEER", passwordHash: hash, position: "Fire Alarm Engineer", qualification: "FIA Unit 3" },
      { email: "engineer2@demo.test", name: "Priya Shah", role: "ENGINEER", passwordHash: hash, position: "Senior Engineer", qualification: "FIA Units 1–4" },
    ])
    .returning();

  const today = todayISO();
  const custData = [
    { name: "Acme Property Management Ltd", accountRef: "ACME01", contactName: "Jane Holloway", contactEmail: "jane@acme.example", contactPhone: "07700 900123", postcode: "SW1A 1AA", addressLines: "1 Example Street\nLondon" },
    { name: "Greenfield Primary School", accountRef: "GRN02", contactName: "Mark Evans", contactEmail: "bursar@greenfield.example", contactPhone: "07700 900456", postcode: "CR0 1AB", addressLines: "School Lane\nCroydon" },
    { name: "Harbour View Care Home", accountRef: "HVC03", contactName: "Lisa Grant", contactEmail: "manager@harbourview.example", contactPhone: "07700 900789", postcode: "BN1 1AA", addressLines: "12 Marine Parade\nBrighton" },
  ];
  const custs = await db.insert(customers).values(custData).returning();

  const siteData = [
    { c: 0, name: "Acme House", addressLines: "22 Station Road\nCroydon", postcode: "CR0 2AA", systemCategory: "L2/M", systemType: "Addressable", panelMake: "Advanced", panelModel: "MxPro 5", panelLocation: "Main reception", zoneCount: 8, arcConnected: true, arcDetails: "Southern Monitoring – A12345", due: addMonthsISO(today, 0).replace(/-\d\d$/, "-01"), eng: eng1.id },
    { c: 0, name: "Acme Warehouse", addressLines: "Unit 7, Riverside Estate\nDartford", postcode: "DA1 5AA", systemCategory: "L3", systemType: "Conventional", panelMake: "C-TEC", panelModel: "CFP708", panelLocation: "Goods-in office", zoneCount: 6, arcConnected: false, arcDetails: "", due: addMonthsISO(today, 1), eng: eng1.id },
    { c: 1, name: "Greenfield Primary School", addressLines: "School Lane\nCroydon", postcode: "CR0 1AB", systemCategory: "L2/M", systemType: "Addressable", panelMake: "Gent", panelModel: "Vigilon", panelLocation: "Front office", zoneCount: 14, arcConnected: false, arcDetails: "", due: addMonthsISO(today, 3), eng: eng2.id },
    { c: 2, name: "Harbour View Care Home", addressLines: "12 Marine Parade\nBrighton", postcode: "BN1 1AA", systemCategory: "L1", systemType: "Addressable", panelMake: "Kentec", panelModel: "Syncro AS", panelLocation: "Nurses' station", zoneCount: 20, arcConnected: true, arcDetails: "Redcare – 99887", due: addMonthsISO(today, -1), eng: eng2.id },
  ];
  for (const s of siteData) {
    const { c, due, eng, ...rest } = s;
    const [site] = await db.insert(sites).values({ ...rest, customerId: custs[c].id, assignedEngineerId: eng }).returning();
    await db.insert(visits).values({ siteId: site.id, type: "SERVICE", status: "DUE", dueDate: due, engineerId: eng });
    if (s.c === 2) {
      // The care home also has emergency lighting on an annual schedule
      await db.insert(visits).values({ siteId: site.id, type: "SERVICE", serviceKind: "EMERGENCY_LIGHTING", status: "DUE", dueDate: addMonthsISO(today, 1), engineerId: eng });
    }
  }

  await db.insert(users).values({ email: "customer@demo.test", name: "Jane Holloway", role: "CUSTOMER", customerId: custs[0].id, passwordHash: hash });

  console.log(`
Demo data loaded. Sign in with password Demo12345! as:
  admin@demo.test       (office admin)
  engineer@demo.test    (engineer)
  customer@demo.test    (customer portal – Acme Property Management)
`);
  void admin;
}

async function main() {
  const args = process.argv.slice(2);
  await db.insert(companySettings).values({ id: "company" }).onConflictDoNothing();
  if (args[0] === "--demo") await demo();
  else if (args[0] === "--admin" && args[1]) await createAdmin(args[1], args.slice(2).join(" ") || "Administrator");
  else console.log('Usage:\n  npm run db:seed -- --admin email@company.co.uk "Full Name"\n  npm run db:seed -- --demo');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
