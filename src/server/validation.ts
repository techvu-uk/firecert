/** Input schemas for admin screens (customers, sites, users, settings). */
import { z } from "zod";

const text = (max = 200) => z.string().trim().max(max, `Maximum ${max} characters`);
const optEmail = z
  .string()
  .trim()
  .max(200)
  .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address");
const optPhone = z
  .string()
  .trim()
  .max(40)
  .refine((v) => v === "" || /^[+\d][\d\s()-]{6,}$/.test(v), "Enter a valid phone number");
const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const optDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date");

export const customerSchema = z
  .object({
    name: text().min(1, "Required"),
    accountRef: text(50),
    addressLines: text(500),
    postcode: text(12),
    contactName: text(),
    contactEmail: optEmail,
    contactPhone: optPhone,
    notifyEmail: checkbox,
    notifySms: checkbox,
    notifyWhatsapp: checkbox,
    notes: text(5000),
  })
  .superRefine((v, ctx) => {
    if ((v.notifySms || v.notifyWhatsapp) && !v.contactPhone)
      ctx.addIssue({ code: "custom", path: ["contactPhone"], message: "Phone number needed for SMS/WhatsApp reminders" });
    if (v.notifyEmail && !v.contactEmail)
      ctx.addIssue({ code: "custom", path: ["contactEmail"], message: "Email needed for email reminders" });
  });

export const SYSTEM_CATEGORIES = ["M", "L1", "L2", "L3", "L4", "L5", "P1", "P2", "L1/M", "L2/M", "L3/M", "L4/M", "L5/M", "P1/M", "P2/M", "LD1 – Grade A", "LD2 – Grade A", "LD3 – Grade A", "L2 – Grade A"];

export const siteSchema = z.object({
  name: text().min(1, "Required"),
  addressLines: text(500).min(1, "Required"),
  postcode: text(12).min(1, "Required"),
  contactName: text(),
  contactEmail: optEmail,
  contactPhone: optPhone,
  systemCategory: text(40),
  systemType: text(50),
  panelMake: text(),
  panelModel: text(),
  panelLocation: text(),
  zoneCount: z.preprocess(
    (v) => (v === "" || v === undefined ? null : Number(v)),
    z.number().int("Whole number").min(0).max(9999).nullable(),
  ),
  arcConnected: checkbox,
  arcDetails: text(),
  serviceIntervalMonths: z.preprocess((v) => Number(v), z.number().int().min(1, "1–24 months").max(24, "1–24 months")),
  assignedEngineerId: z.string().trim(),
  accessNotes: text(5000),
  nextServiceDue: optDate,
  nextElDue: optDate,
});

export const userSchema = z.object({
  name: text().min(1, "Required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: optPhone,
  role: z.enum(["ADMIN", "ENGINEER"]),
  position: text(),
  qualification: text(),
  active: checkbox,
});

export const portalUserSchema = z.object({
  name: text().min(1, "Required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export const settingsSchema = z.object({
  name: text().min(1, "Required"),
  addressLines: text(500),
  phone: optPhone,
  email: optEmail,
  website: text(),
  certificationBody: text(),
  certificationNo: text(50),
  certPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,6}$/, "1–6 letters"),
  defaultServiceMonths: z.preprocess((v) => Number(v), z.number().int().min(1).max(24)),
  tagline: text(),
  companyRegNo: text(30),
  mobile: optPhone,
});

export function formToObject(fd: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string" && !k.startsWith("$ACTION")) o[k] = v;
  });
  return o;
}
