/**
 * Form engine types.
 *
 * Every certificate/report in the app is described by a FormDefinition. The same
 * definition drives the on-screen form, validation, and the PDF output — so adding
 * a new certificate type means writing one definition file and registering it.
 * See docs/ADDING-FORMS.md.
 */
import type { ServiceKind } from "@/lib/service-kinds";

export type Option = { value: string; label: string };

/** Show a field/section only when another top-level field has one of the given values. */
export type Condition = { field: string; equals: string | boolean | (string | boolean)[] };

interface FieldBase {
  /** Key used to store the value. Must be unique within the form. Never rename once in use. */
  name: string;
  label: string;
  help?: string;
  required?: boolean;
  /** Layout hint on wide screens. Phones always use full width. */
  width?: "full" | "half" | "third";
  showIf?: Condition;
  /** Hide this field from the PDF (still stored). */
  pdfHidden?: boolean;
}

export interface TextField extends FieldBase {
  type: "text";
  placeholder?: string;
  maxLength?: number;
}
export interface TextAreaField extends FieldBase {
  type: "textarea";
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}
export interface NumberField extends FieldBase {
  type: "number";
  min?: number;
  max?: number;
  /** Decimal places allowed (0 = whole numbers). Default 2. */
  decimals?: number;
  unit?: string;
}
export interface DateField extends FieldBase {
  type: "date";
  /** Reject dates after today. */
  notFuture?: boolean;
}
export interface SelectField extends FieldBase {
  type: "select";
  options: Option[];
}
export interface RadioField extends FieldBase {
  type: "radio";
  options: Option[];
}
export interface CheckboxField extends FieldBase {
  type: "checkbox";
  /** If required, the box must be ticked (used for declarations). */
}
export interface YesNoField extends FieldBase {
  type: "yesno";
  allowNA?: boolean;
}
/**
 * An inspection/test item. Results: PASS / FAIL / NA (and LIM if allowed).
 * A comment is required on FAIL and LIM. Consecutive check fields print as a table on the PDF.
 */
export interface CheckField extends FieldBase {
  type: "check";
  /** Item number shown in the first column, e.g. "12". */
  number?: string;
  /** "pass-fail" shows Pass/Fail; "tick-cross" shows ✓/✗ (as on BS model certificates). */
  style?: "pass-fail" | "tick-cross";
  /** Allow "LIM" (limitation agreed with the client). */
  allowLim?: boolean;
}
/** A list of tick boxes; stores the ticked option values. */
export interface ChecklistField extends FieldBase {
  type: "checklist";
  options: Option[];
}
export interface SignatureField extends FieldBase {
  type: "signature";
}
export interface PhotosField extends FieldBase {
  type: "photos";
  maxPhotos?: number;
}
/** Static text shown on the form and PDF (e.g. a declaration). Stores nothing. */
export interface NoteField extends Omit<FieldBase, "required"> {
  type: "note";
  text: string;
}
/** Value worked out from other fields (e.g. false alarm rate). Saved with the certificate. */
export interface ComputedField extends Omit<FieldBase, "required"> {
  type: "computed";
  compute: (data: FormData) => string;
  unit?: string;
}
/** Filled in by the system when the certificate is issued (e.g. next service due). */
export interface AutoField extends Omit<FieldBase, "required"> {
  type: "auto";
  format?: "date" | "month";
  placeholder?: string;
}

export type ColumnField = TextField | NumberField | SelectField | DateField | YesNoField;

export interface TableField extends FieldBase {
  type: "table";
  columns: ColumnField[];
  minRows?: number;
  maxRows?: number;
  addLabel?: string;
  /** Show a row number column on the PDF. */
  numbered?: boolean;
}

export type Field =
  | TextField
  | TextAreaField
  | NumberField
  | DateField
  | SelectField
  | RadioField
  | CheckboxField
  | YesNoField
  | CheckField
  | ChecklistField
  | SignatureField
  | PhotosField
  | NoteField
  | ComputedField
  | AutoField
  | TableField;

export type FieldType = Field["type"];

export interface Section {
  id: string;
  title: string;
  description?: string;
  showIf?: Condition;
  fields: Field[];
}

/** Values stored for each field type. */
export type CheckValue = { result: "PASS" | "FAIL" | "NA" | "LIM" | ""; note?: string };
export type SignatureValue = { image: string; signedAt: string } | null;
export type PhotoValue = { id: string; caption?: string };
export type FormData = Record<string, unknown>;

export interface PrefillContext {
  today: string; // YYYY-MM-DD
  site: {
    name: string;
    address: string;
    postcode: string;
    systemCategory: string;
    systemType: string;
    panelMake: string;
    panelModel: string;
    panelLocation: string;
    zoneCount: number | null;
    arcConnected: boolean;
    arcDetails: string;
    serviceIntervalMonths: number;
  };
  customer: { name: string; accountRef: string };
  /** Site contact, falling back to the customer's main contact. */
  contact: { name: string; phone: string; email: string };
  engineer: { name: string; position: string; qualification: string };
  company: { name: string };
  /** Number of the most recent issued certificate of each form type at this site. */
  previousCertificates: Record<string, string>;
}

export type ScheduleEffect = "complete-service" | "start-schedule" | "none";

export interface FormDefinition {
  /** Stable identifier stored with each certificate. Never change once used. */
  id: string;
  /** Bump when making changes that would alter how existing certificates display. */
  version: number;
  title: string;
  shortTitle: string;
  /** Standard the form is based on, printed on the PDF. */
  standard: string;
  /** Optional sub-heading under the title on the PDF. */
  subtitle?: string;
  description: string;
  /** Which kind of visit this form records. */
  visitType: "SERVICE" | "INSTALLATION" | "REMEDIAL" | "OTHER";
  /** Which recurring service schedule this form belongs to. Default FIRE_ALARM. */
  serviceKind?: ServiceKind;
  /**
   * What happens to the site's service schedule when issued:
   *  - "complete-service": completes the open service visit and schedules the next one
   *  - "start-schedule": (re)starts the service schedule from the issue date
   *  - "none": no effect
   */
  scheduleEffect: ScheduleEffect | ((data: FormData) => ScheduleEffect);
  /** Number field holding the months until the next service. Falls back to the site's interval. */
  intervalField?: string;
  /** "auto" field that receives the next service due date when issued. */
  nextDueField?: string;
  /** Name of a radio/select field whose value is the overall result (shown in lists). */
  outcomeField?: string;
  /** Name of the date field that records the visit date (used for scheduling). */
  visitDateField: string;
  /** Hide from "New certificate" menus (keep for old certificates). */
  retired?: boolean;
  /** Text printed on the final page of the PDF (e.g. notes for the recipient). */
  pdfFooterNotes?: string[];
  prefill?: (ctx: PrefillContext) => FormData;
  sections: Section[];
}
