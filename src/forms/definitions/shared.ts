/**
 * Reusable building blocks for form definitions. Use these so that common sections
 * (system details, signatures, defect tables) look and behave the same on every form.
 */
import type { CheckField, Field, Option, PrefillContext, TableField, YesNoField } from "../types";

export const SYSTEM_TYPES: Option[] = [
  { value: "Conventional", label: "Conventional" },
  { value: "Addressable", label: "Addressable" },
  { value: "Wireless", label: "Wireless" },
  { value: "Hybrid", label: "Hybrid (wired & wireless)" },
];

export const DEFECT_PRIORITIES: Option[] = [
  { value: "CRITICAL", label: "Critical – immediate action" },
  { value: "SIGNIFICANT", label: "Significant – action required" },
  { value: "ADVISORY", label: "Advisory / recommendation" },
];

export const DEFECT_ACTIONS: Option[] = [
  { value: "RECTIFIED", label: "Rectified on visit" },
  { value: "QUOTE", label: "Quotation to follow" },
  { value: "CUSTOMER", label: "Customer to action" },
  { value: "ADVISORY", label: "Advisory only" },
];

export const check = (name: string, label: string, help?: string): CheckField => ({
  type: "check",
  name,
  label,
  help,
  required: true,
});

export const yesNo = (name: string, label: string, opts: Partial<YesNoField> = {}): YesNoField => ({
  type: "yesno",
  name,
  label,
  required: true,
  ...opts,
});

/** System details block, prefilled from the site record. */
export const systemFields = (): Field[] => [
  {
    type: "text",
    name: "systemCategory",
    label: "System category",
    placeholder: "e.g. L2 or L2/M",
    required: true,
    width: "third",
    help: "Category of system as defined in BS 5839-1 (M, L1–L5, P1, P2).",
  },
  { type: "select", name: "systemType", label: "System type", options: SYSTEM_TYPES, required: true, width: "third" },
  { type: "number", name: "zoneCount", label: "Number of zones", decimals: 0, min: 0, max: 9999, width: "third" },
  { type: "text", name: "panelMake", label: "Panel manufacturer", required: true, width: "third" },
  { type: "text", name: "panelModel", label: "Panel model", width: "third" },
  { type: "text", name: "panelLocation", label: "Panel location", width: "third" },
  yesNo("arcConnected", "Connected to an Alarm Receiving Centre (ARC)", { width: "half" }),
  {
    type: "text",
    name: "arcDetails",
    label: "ARC name / account number",
    width: "half",
    showIf: { field: "arcConnected", equals: "YES" },
  },
];

export const prefillSystem = (ctx: PrefillContext) => ({
  systemCategory: ctx.site.systemCategory,
  systemType: ctx.site.systemType,
  zoneCount: ctx.site.zoneCount,
  panelMake: ctx.site.panelMake,
  panelModel: ctx.site.panelModel,
  panelLocation: ctx.site.panelLocation,
  arcConnected: ctx.site.arcConnected ? "YES" : "NO",
  arcDetails: ctx.site.arcDetails,
});

export const defectsTable = (name = "defects", label = "Defects and observations"): TableField => ({
  type: "table",
  name,
  label,
  minRows: 1,
  maxRows: 100,
  addLabel: "Add defect",
  required: true,
  columns: [
    { type: "text", name: "location", label: "Location / device", required: true },
    { type: "text", name: "description", label: "Description", required: true },
    { type: "select", name: "priority", label: "Priority", options: DEFECT_PRIORITIES, required: true },
    { type: "select", name: "action", label: "Action", options: DEFECT_ACTIONS, required: true },
  ],
});

/** System status at the end of the visit. */
export const leftInServiceFields = (): Field[] => [
  yesNo("leftOperational", "System left fully operational and in normal condition"),
  {
    type: "textarea",
    name: "disabledDetails",
    label: "Parts of the system disabled or left in fault",
    help: "Describe what is not operational and confirm the responsible person has been told.",
    required: true,
    showIf: { field: "leftOperational", equals: "NO" },
  },
  yesNo("logbookSigned", "Log book completed and signed"),
];

/** Engineer + responsible person signatures. */
export function declarationFields(
  statement: string,
  opts: { customer?: "required" | "optional" | "none"; customerLabel?: string } = {},
): Field[] {
  const customer = opts.customer ?? "required";
  const who = opts.customerLabel ?? "Responsible person";
  const fields: Field[] = [
    { type: "note", name: "declarationText", label: "Declaration", text: statement },
    { type: "text", name: "engineerName", label: "Name", required: true, width: "half" },
    { type: "text", name: "engineerPosition", label: "Position / qualification", width: "half" },
    { type: "signature", name: "engineerSignature", label: "Signature", required: true, width: "half" },
    { type: "date", name: "engineerSignedDate", label: "Date signed", required: true, notFuture: true, width: "half" },
  ];
  if (customer === "none") return fields;
  const req = customer === "required";
  return [
    ...fields,
    {
      type: "checkbox",
      name: "customerUnavailable",
      label: req ? `${who} not available to sign` : `${who} not signing`,
      pdfHidden: true,
    },
    { type: "text", name: "customerName", label: `${who} name`, required: req, width: "half", showIf: { field: "customerUnavailable", equals: false } },
    { type: "text", name: "customerPosition", label: "Position", width: "half", showIf: { field: "customerUnavailable", equals: false } },
    { type: "signature", name: "customerSignature", label: `${who} signature`, required: req, showIf: { field: "customerUnavailable", equals: false } },
  ];
}

export const prefillDeclaration = (ctx: PrefillContext) => ({
  engineerName: ctx.engineer.name,
  engineerPosition: [ctx.engineer.position, ctx.engineer.qualification].filter(Boolean).join(" – "),
  engineerSignedDate: ctx.today,
  customerUnavailable: false,
});

/** Client reference and occupier (Part 1 on the BS model certificates). */
export const clientFields = (): Field[] => [
  { type: "text", name: "jobReference", label: "Job / project reference", width: "third", placeholder: "e.g. 1903-FA" },
  { type: "text", name: "clientReference", label: "Client reference number", width: "third" },
  { type: "text", name: "occupier", label: "Occupier", width: "third" },
];

export const prefillClient = (ctx: PrefillContext) => ({
  clientReference: ctx.customer.accountRef,
  occupier: ctx.customer.name,
});

/** Tick/cross inspection item with an item number, as on the BS model certificates. */
export const item = (number: number, name: string, label: string, opts: { allowLim?: boolean; help?: string } = {}): CheckField => ({
  type: "check",
  name,
  number: String(number),
  label,
  style: "tick-cross",
  required: true,
  allowLim: opts.allowLim,
  help: opts.help,
});
