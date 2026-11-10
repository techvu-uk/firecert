// End-to-end walkthrough. Needs the app running on :3000 with demo data (npm run db:seed -- --demo).
// Run: node tests/e2e/walkthrough.cjs   (screenshots go to SHOTS dir below)
const { chromium, devices } = require("playwright");
const { writeFileSync } = require("node:fs");

(async () => {
const BASE = "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR ?? "./e2e-shots"; require("node:fs").mkdirSync(SHOTS, { recursive: true });
const log = (...a) => console.log("•", ...a);
const assert = (c, m) => { if (!c) throw new Error("ASSERT FAILED: " + m); log("ok -", m); };

const path = require("node:path");
const INSPECTION = require(path.join(__dirname, "inspection-data.json"));
const EMERGENCY = require(path.join(__dirname, "emergency-lighting-data.json"));
const withoutSigs = (d) => { const c = { ...d }; delete c.engineerSignature; delete c.customerSignature; return c; };
const fullData = (today) => ({ ...withoutSigs(INSPECTION), visitDate: today, engineerSignedDate: today });

async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "Demo12345!");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click('button[type="submit"]')]);
}

async function sign(page, label) {
  const canvas = page.locator(`label:has-text("${label}") + div canvas`).first();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 30, box.y + 90);
  await page.mouse.down();
  for (let i = 0; i < 20; i++) await page.mouse.move(box.x + 30 + i * 12, box.y + 90 - Math.sin(i / 2) * 30, { steps: 2 });
  await page.mouse.up();
  await page.locator(`label:has-text("${label}") + div button:has-text("Use this signature")`).click();
}

const browser = await chromium.launch();
try {
  // ---------- Engineer on a phone ----------
  const phone = await browser.newContext({ ...devices["iPhone 13"] });
  const p = await phone.newPage();
  p.on("pageerror", (e) => console.error("PAGE ERROR", e.message));
  await login(p, "engineer@demo.test");
  assert(p.url().endsWith("/dashboard"), "engineer lands on dashboard");
  await p.screenshot({ path: `${SHOTS}/01-phone-dashboard.png` });

  // Engineers cannot reach admin pages
  await p.goto(`${BASE}/settings`);
  assert(p.url().endsWith("/dashboard"), "engineer redirected away from settings");

  // Start a certificate from the site search
  await p.goto(`${BASE}/certificates/new?q=Acme House`);
  await p.click("text=Acme House");
  await p.waitForURL(/siteId=/);
  await Promise.all([p.waitForURL(/\/certificates\/[0-9a-f-]{36}$/), p.click("text=Fire Alarm Inspection & Servicing")]);
  const certUrl = p.url();
  const certId = certUrl.split("/").pop();
  log("draft", certId);
  await p.screenshot({ path: `${SHOTS}/02-phone-editor-top.png` });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 0, `editor fits the phone screen (overflow ${overflow}px)`);
  assert(await p.inputValue("#f-panelMake") === "Advanced", "system details pre-filled from site");

  // Try to issue an incomplete certificate → blocked with errors
  await p.click('button:has-text("Issue")');
  await p.waitForSelector("text=still need completing");
  assert(true, "incomplete certificate blocked from issuing");
  await p.screenshot({ path: `${SHOTS}/03-phone-validation.png` });

  // Interact with real controls: fail a check → note required
  const item16 = p.locator('div.rounded-lg.border:has(span:text-is("16"))').first();
  await item16.locator('button:has-text("✗")').click();
  await p.waitForSelector('textarea[placeholder^="Describe the defect"]');
  assert(true, "marking an item ✗ reveals the required comment");
  await item16.locator('button:has-text("✓")').click();

  // Fill everything else through the autosave API (same as the editor uses), then reload
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const r = await p.request.put(`${BASE}/api/certificates/${certId}/draft`, { data: { data: fullData(today) } });
  assert(r.ok(), "draft saved via API");
  await p.reload();
  assert(await p.inputValue("#f-extent") === "HMO property – fire alarm test", "saved data reloads into editor");
  assert((await p.textContent("main")).includes("0.0"), "false alarm rate calculated");

  // Signatures with a finger
  await sign(p, "Signature");
  // Photo upload
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR42mP4z8DwHwqxMwYBALxGB/kAuj7cAAAAAElFTkSuQmCC", "base64");
  await p.locator('input[type="file"]').setInputFiles({ name: "defect.png", mimeType: "image/png", buffer: png });
  await p.waitForSelector('img[alt="Photo 1"]');
  assert(true, "photo uploaded");
  await p.fill('input[placeholder="Caption"]', "Racking under detector");
  await p.waitForSelector("text=Saved", { timeout: 10000 });
  await p.locator('#section-part3').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${SHOTS}/04-phone-signatures.png` });

  // Issue
  await p.click('button:has-text("Issue")');
  await p.click('button:has-text("Issue certificate")');
  await p.waitForSelector("text=Certificate issued", { timeout: 20000 });
  const issuedText = await p.textContent("body");
  const number = issuedText.match(/TV-\d{4}-\d{6}/)?.[0];
  assert(number, `certificate issued with number ${number}`);
  await p.screenshot({ path: `${SHOTS}/05-phone-issued.png` });

  // PDF
  const pdf = await p.request.get(`${BASE}/api/certificates/${certId}/pdf`);
  assert(pdf.headers()["content-type"] === "application/pdf", "PDF served");
  const pdfBytes = await pdf.body();
  writeFileSync(`${SHOTS}/issued.pdf`, pdfBytes);
  assert(pdfBytes.length > 10000, `PDF size ${pdfBytes.length} bytes`);

  // Locked after issue
  const again = await p.request.put(`${BASE}/api/certificates/${certId}/draft`, { data: { data: {} } });
  assert(again.status() === 400, "issued certificate can no longer be edited");

  // Site now shows next service 6 months later
  await p.click("text=View certificate");
  await p.waitForSelector(`text=${number}`);
  await p.screenshot({ path: `${SHOTS}/06-phone-cert-view.png`, fullPage: false });
  await phone.close();

  // ---------- Admin on desktop ----------
  const desk = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const a = await desk.newPage();
  a.on("pageerror", (e) => console.error("PAGE ERROR", e.message));
  await login(a, "admin@demo.test");
  await a.screenshot({ path: `${SHOTS}/07-desktop-dashboard.png` });
  await a.goto(`${BASE}/customers?q=Acme`);
  await Promise.all([a.waitForURL(/\/customers\/[0-9a-f-]{36}$/), a.click("text=Acme Property Management Ltd")]);
  await Promise.all([a.waitForURL(/\/sites\/[0-9a-f-]{36}$/), a.click("text=Acme House")]);
  const siteUrl = a.url();
  const siteText = await a.textContent("main");
  const expectedDue = (() => { const d = new Date(today + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 6); return d.toISOString().slice(0, 10); })();
  const [y, m, dd] = expectedDue.split("-");
  const monthName = new Date(expectedDue + "T00:00:00Z").toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  assert(siteText.includes(`${dd} ${monthName} ${y}`), `next service scheduled for ${dd} ${monthName} ${y}`);
  assert(siteText.includes("Done"), "previous service visit marked done");

  // Emergency lighting has its own schedule on the same site
  await Promise.all([a.waitForURL(/\/certificates\/[0-9a-f-]{36}$/), a.click("text=Emergency Lighting Inspection")]);
  const elId = a.url().split("/").pop();
  const sigPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  const elSave = await a.request.put(`${BASE}/api/certificates/${elId}/draft`, {
    data: { data: { ...EMERGENCY, visitDate: today, engineerSignedDate: today, engineerSignature: { image: sigPng, signedAt: new Date().toISOString() } } },
  });
  assert(elSave.ok(), "emergency lighting draft saved");
  await a.reload();
  await a.click('button:has-text("Issue")');
  await a.click('button:has-text("Issue certificate")');
  await a.waitForSelector("text=Certificate issued", { timeout: 20000 });
  const elDue = (() => { const d = new Date(today + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 12); return d; })();
  const elDueText = `${String(elDue.getUTCDate()).padStart(2, "0")} ${elDue.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })} ${elDue.getUTCFullYear()}`;
  assert((await a.textContent("main")).includes(`Next service due ${elDueText}`), `emergency lighting next due ${elDueText} (12 months)`);
  await a.goto(siteUrl);
  const both = await a.textContent("main");
  assert(both.includes("Emergency lighting inspection") && both.includes(`${dd} ${monthName} ${y}`), "site shows separate fire alarm and emergency lighting schedules");
  await a.screenshot({ path: `${SHOTS}/08b-desktop-site-two-schedules.png`, fullPage: true });
  await a.screenshot({ path: `${SHOTS}/08-desktop-site.png`, fullPage: true });

  // Book the next visit
  await Promise.all([a.waitForURL(/\/schedule\//), a.locator("text=Book visit").first().click()]);
  await a.fill('input[name="bookedFor"]', `${y}-${m}-${String(Number(dd) - 3).padStart(2, "0")}T09:30`);
  await Promise.all([a.waitForURL(/\/sites\//), a.click('button:has-text("Book visit")')]);
  assert((await a.textContent("main")).includes("Booked for"), "visit booked");

  // Schedule page
  await a.goto(`${BASE}/schedule?filter=overdue`);
  await a.screenshot({ path: `${SHOTS}/09-desktop-schedule.png` });

  // Invite a portal user and add a customer
  await a.goto(`${BASE}/customers/new`);
  await a.click('button:has-text("Create customer")');
  assert(a.url().endsWith("/customers/new"), "browser blocks empty required fields");
  await a.fill('input[name="name"]', "Test Lettings Ltd");
  await a.fill('input[name="contactEmail"]', "office@testlettings.example");
  await a.fill('input[name="contactPhone"]', "abc");
  await a.click('button:has-text("Create customer")');
  await a.waitForSelector("text=Enter a valid phone number");
  assert(true, "server rejects invalid phone with field message");
  assert(await a.inputValue('input[name="name"]') === "Test Lettings Ltd", "typed values kept after a validation error");
  await a.fill('input[name="contactPhone"]', "07700 900111");
  await Promise.all([a.waitForURL(/\/customers\/[0-9a-f-]{36}$/), a.click('button:has-text("Create customer")')]);
  await a.fill('input[name="name"] >> nth=-1', "Tom Tenant");
  await a.locator('input[name="email"]').last().fill("tom@testlettings.example");
  await a.click('button:has-text("Invite to portal")');
  await a.waitForSelector("text=Invitation sent");
  const inviteLink = (await a.locator("text=/set-password/").first().textContent()).trim();
  assert(inviteLink.includes("/set-password/"), "portal invite link generated");

  // Void & reissue
  await a.goto(`${BASE}/certificates/${certId}`);
  await a.screenshot({ path: `${SHOTS}/10-desktop-cert.png`, fullPage: true });
  await a.fill('textarea[name="reason"]', "Wrong panel model recorded");
  await Promise.all([a.waitForURL((u) => !u.pathname.endsWith(certId)), a.click('button:has-text("Void certificate")')]);
  await a.waitForSelector("text=This certificate replaces");
  assert(true, "void creates a corrected draft linked to the original");

  // Notification log
  await a.goto(`${BASE}/notifications`);
  const notif = await a.textContent("main");
  assert(notif.includes("CERT_ISSUED") && notif.includes("BOOKED") && notif.includes("INVITE"), "notifications logged (issued, booked, invite)");
  await a.screenshot({ path: `${SHOTS}/11-desktop-notifications.png` });
  await desk.close();

  // ---------- New portal user accepts invite ----------
  const inv = await browser.newContext({ ...devices["Pixel 7"] });
  const t = await inv.newPage();
  await t.goto(inviteLink);
  await t.fill('input[name="password"]', "short");
  await t.fill('input[name="confirm"]', "short");
  await t.click('button:has-text("Save and sign in")');
  await t.waitForSelector("text=at least 10 characters");
  await t.fill('input[name="password"]', "GoodPassword123");
  await t.fill('input[name="confirm"]', "GoodPassword123");
  await Promise.all([t.waitForURL(/\/portal/), t.click('button:has-text("Save and sign in")')]);
  assert(true, "invite accepted, lands in portal");
  // The used link can't be reused
  await t.goto(inviteLink);
  assert((await t.textContent("main")).includes("Link expired"), "invite link is single-use");
  await inv.close();

  // ---------- Customer portal ----------
  const cust = await browser.newContext({ ...devices["iPhone 13"] });
  const c = await cust.newPage();
  await login(c, "customer@demo.test");
  assert(c.url().endsWith("/portal"), "customer lands on portal");
  const portal = await c.textContent("main");
  assert(!portal.includes(number), "voided certificate hidden from customer");
  await c.screenshot({ path: `${SHOTS}/12-phone-portal.png`, fullPage: true });
  const voidedPdf = await c.request.get(`${BASE}/api/certificates/${certId}/pdf`);
  assert(voidedPdf.status() === 404, "customer can't fetch a voided certificate");
  await c.goto(`${BASE}/dashboard`);
  assert(c.url().endsWith("/portal"), "customer blocked from staff area");
  const api = await c.request.put(`${BASE}/api/certificates/${certId}/draft`, { data: { data: {} } });
  assert(api.status() === 403, "customer blocked from staff API");
  await cust.close();

  // ---------- Bad login ----------
  const anon = await browser.newPage();
  await anon.goto(`${BASE}/login`);
  await anon.fill('input[name="email"]', "admin@demo.test");
  await anon.fill('input[name="password"]', "wrong");
  await anon.click('button[type="submit"]');
  await anon.waitForSelector("text=Email or password is incorrect");
  assert(true, "wrong password rejected");
  await anon.screenshot({ path: `${SHOTS}/00-login.png` });

  console.log("\nALL E2E CHECKS PASSED");
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
})();
