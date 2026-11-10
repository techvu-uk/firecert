/**
 * Database schema (PostgreSQL, Drizzle ORM).
 *
 * To change the database: edit this file, then run `npm run db:generate -- --name <change>`
 * to produce a SQL migration in /drizzle, and `npm run db:migrate` to apply it.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  date,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const roleEnum = pgEnum("role", ["ADMIN", "ENGINEER", "CUSTOMER"]);
export const visitTypeEnum = pgEnum("visit_type", ["SERVICE", "INSTALLATION", "REMEDIAL", "OTHER"]);
export const visitStatusEnum = pgEnum("visit_status", ["DUE", "BOOKED", "COMPLETED", "CANCELLED"]);
export const certStatusEnum = pgEnum("certificate_status", ["DRAFT", "ISSUED", "VOID"]);
export const tokenTypeEnum = pgEnum("token_type", ["INVITE", "RESET"]);

export type Role = (typeof roleEnum.enumValues)[number];
export type VisitType = (typeof visitTypeEnum.enumValues)[number];
export type VisitStatus = (typeof visitStatusEnum.enumValues)[number];
export type CertificateStatus = (typeof certStatusEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// Company settings (single row, id = "company")
// ---------------------------------------------------------------------------
export const companySettings = pgTable("company_settings", {
  id: text("id").primaryKey().default("company"),
  name: text("name").notNull().default("TechVu Fire & Security"),
  addressLines: text("address_lines").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  website: text("website").notNull().default(""),
  certificationBody: text("certification_body").notNull().default(""),
  certificationNo: text("certification_no").notNull().default(""),
  certPrefix: text("cert_prefix").notNull().default("TV"),
  defaultServiceMonths: integer("default_service_months").notNull().default(6),
  tagline: text("tagline").notNull().default(""),
  companyRegNo: text("company_reg_no").notNull().default(""),
  mobile: text("mobile").notNull().default(""),
  updatedAt: updatedAt(),
});

// ---------------------------------------------------------------------------
// Customers & users
// ---------------------------------------------------------------------------
export const customers = pgTable(
  "customers",
  {
    id: id(),
    name: text("name").notNull(),
    accountRef: text("account_ref"),
    addressLines: text("address_lines").notNull().default(""),
    postcode: text("postcode").notNull().default(""),
    contactName: text("contact_name").notNull().default(""),
    contactEmail: text("contact_email").notNull().default(""),
    contactPhone: text("contact_phone").notNull().default(""),
    notifyEmail: boolean("notify_email").notNull().default(true),
    notifySms: boolean("notify_sms").notNull().default(false),
    notifyWhatsapp: boolean("notify_whatsapp").notNull().default(false),
    notes: text("notes").notNull().default(""),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("customers_account_ref_uq").on(t.accountRef), index("customers_name_idx").on(t.name)],
);

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    role: roleEnum("role").notNull(),
    passwordHash: text("password_hash"),
    active: boolean("active").notNull().default(true),
    position: text("position").notNull().default(""),
    qualification: text("qualification").notNull().default(""),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(sql`lower(${t.email})`), index("users_customer_idx").on(t.customerId)],
);

export const authTokens = pgTable("auth_tokens", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: tokenTypeEnum("type").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------
export const sites = pgTable(
  "sites",
  {
    id: id(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    addressLines: text("address_lines").notNull().default(""),
    postcode: text("postcode").notNull().default(""),
    contactName: text("contact_name").notNull().default(""),
    contactEmail: text("contact_email").notNull().default(""),
    contactPhone: text("contact_phone").notNull().default(""),
    systemCategory: text("system_category").notNull().default(""),
    systemType: text("system_type").notNull().default(""),
    panelMake: text("panel_make").notNull().default(""),
    panelModel: text("panel_model").notNull().default(""),
    panelLocation: text("panel_location").notNull().default(""),
    zoneCount: integer("zone_count"),
    arcConnected: boolean("arc_connected").notNull().default(false),
    arcDetails: text("arc_details").notNull().default(""),
    serviceIntervalMonths: integer("service_interval_months").notNull().default(6),
    lastServiceDate: date("last_service_date"),
    assignedEngineerId: text("assigned_engineer_id").references(() => users.id, { onDelete: "set null" }),
    accessNotes: text("access_notes").notNull().default(""),
    archived: boolean("archived").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sites_customer_idx").on(t.customerId)],
);

// A visit is a planned or completed attendance. Each active site has at most one
// open SERVICE visit (status DUE or BOOKED) representing its next service.
export const visits = pgTable(
  "visits",
  {
    id: id(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    type: visitTypeEnum("type").notNull().default("SERVICE"),
    // Which recurring service this is (see src/lib/service-kinds.ts)
    serviceKind: text("service_kind").notNull().default("FIRE_ALARM"),
    status: visitStatusEnum("status").notNull().default("DUE"),
    dueDate: date("due_date").notNull(),
    bookedFor: timestamp("booked_for", { withTimezone: true }),
    engineerId: text("engineer_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes").notNull().default(""),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Date the service was actually carried out (from the certificate)
    serviceDate: date("service_date"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("visits_site_status_idx").on(t.siteId, t.status),
    index("visits_due_idx").on(t.dueDate),
    // Guarantees one open service visit per site per service kind
    uniqueIndex("visits_one_open_service_uq")
      .on(t.siteId, t.serviceKind)
      .where(sql`${t.type} = 'SERVICE' AND ${t.status} IN ('DUE','BOOKED')`),
  ],
);

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------
export const certificates = pgTable(
  "certificates",
  {
    id: id(),
    number: text("number").unique(),
    formId: text("form_id").notNull(),
    formVersion: integer("form_version").notNull(),
    status: certStatusEnum("status").notNull().default("DRAFT"),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "restrict" }),
    visitId: text("visit_id").references(() => visits.id, { onDelete: "set null" }),
    engineerId: text("engineer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    outcome: text("outcome"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    pdfKey: text("pdf_key"),
    pdfSha256: text("pdf_sha256"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    supersedesId: text("supersedes_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("certs_site_status_idx").on(t.siteId, t.status),
    index("certs_status_issued_idx").on(t.status, t.issuedAt),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: id(),
    certificateId: text("certificate_id")
      .notNull()
      .references(() => certificates.id, { onDelete: "cascade" }),
    fieldName: text("field_name").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    caption: text("caption").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("attachments_cert_idx").on(t.certificateId)],
);

export const certificateSequences = pgTable("certificate_sequences", {
  year: integer("year").primaryKey(),
  lastNumber: integer("last_number").notNull().default(0),
});

// ---------------------------------------------------------------------------
// Notifications & audit
// ---------------------------------------------------------------------------
export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: id(),
    kind: text("kind").notNull(),
    channel: text("channel").notNull(),
    recipient: text("recipient").notNull(),
    status: text("status").notNull(),
    error: text("error"),
    subject: text("subject").notNull().default(""),
    visitId: text("visit_id").references(() => visits.id, { onDelete: "set null" }),
    certificateId: text("certificate_id").references(() => certificates.id, { onDelete: "set null" }),
    // Prevents the same reminder reaching the same person twice
    dedupeKey: text("dedupe_key").unique(),
    createdAt: createdAt(),
  },
  (t) => [index("notif_visit_idx").on(t.visitId), index("notif_created_idx").on(t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId)],
);

// ---------------------------------------------------------------------------
// Relations (for db.query.* helpers)
// ---------------------------------------------------------------------------
export const customersRelations = relations(customers, ({ many }) => ({
  sites: many(sites),
  users: many(users),
}));

export const usersRelations = relations(users, ({ one }) => ({
  customer: one(customers, { fields: [users.customerId], references: [customers.id] }),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  customer: one(customers, { fields: [sites.customerId], references: [customers.id] }),
  assignedEngineer: one(users, { fields: [sites.assignedEngineerId], references: [users.id] }),
  visits: many(visits),
  certificates: many(certificates),
}));

export const visitsRelations = relations(visits, ({ one }) => ({
  site: one(sites, { fields: [visits.siteId], references: [sites.id] }),
  engineer: one(users, { fields: [visits.engineerId], references: [users.id] }),
}));

export const certificatesRelations = relations(certificates, ({ one, many }) => ({
  site: one(sites, { fields: [certificates.siteId], references: [sites.id] }),
  engineer: one(users, { fields: [certificates.engineerId], references: [users.id] }),
  visit: one(visits, { fields: [certificates.visitId], references: [visits.id] }),
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  certificate: one(certificates, { fields: [attachments.certificateId], references: [certificates.id] }),
}));

export type Customer = typeof customers.$inferSelect;
export type User = typeof users.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type Visit = typeof visits.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type CompanySettings = typeof companySettings.$inferSelect;
