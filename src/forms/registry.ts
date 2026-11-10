/**
 * Central list of all form definitions.
 *
 * To add a form: create a file in ./definitions, then add it to ALL_FORMS below.
 * To change a form that is already in use: copy it to a new version (e.g. MyFormV2 with
 * version: 2), add it here, and mark the old one `retired: true`. Existing certificates
 * keep rendering with the version they were created with.
 */
import { inspectionServicingV1 } from "./definitions/inspection-servicing";
import { installationCommissioningV1 } from "./definitions/installation-commissioning";
import { remedialWorksV1 } from "./definitions/remedial-works";
import { designV1 } from "./definitions/design";
import { emergencyLightingV1 } from "./definitions/emergency-lighting";
import type { Field, FormData, FormDefinition, ScheduleEffect } from "./types";

export function scheduleEffectFor(def: FormDefinition, data: FormData): ScheduleEffect {
  return typeof def.scheduleEffect === "function" ? def.scheduleEffect(data) : def.scheduleEffect;
}

export const ALL_FORMS: FormDefinition[] = [
  designV1,
  installationCommissioningV1,
  inspectionServicingV1,
  emergencyLightingV1,
  remedialWorksV1,
];

/** Latest non-retired version of each form, for "New certificate" menus. */
export function activeForms(): FormDefinition[] {
  const latest = new Map<string, FormDefinition>();
  for (const f of ALL_FORMS) {
    if (f.retired) continue;
    const cur = latest.get(f.id);
    if (!cur || f.version > cur.version) latest.set(f.id, f);
  }
  return [...latest.values()];
}

export function getForm(id: string, version?: number): FormDefinition {
  const matches = ALL_FORMS.filter((f) => f.id === id);
  const form =
    version === undefined
      ? matches.filter((f) => !f.retired).sort((a, b) => b.version - a.version)[0]
      : matches.find((f) => f.version === version);
  if (!form) throw new Error(`Unknown form ${id}${version !== undefined ? ` v${version}` : ""}`);
  return form;
}

export function allFields(def: FormDefinition): Field[] {
  return def.sections.flatMap((s) => s.fields);
}

/**
 * Checks a definition for mistakes (duplicate names, bad references). Runs in the test
 * suite for every registered form so errors are caught before deployment.
 */
export function checkDefinition(def: FormDefinition): string[] {
  const problems: string[] = [];
  const fields = allFields(def);
  const names = new Map<string, Field>();
  const sectionIds = new Set<string>();

  for (const s of def.sections) {
    if (sectionIds.has(s.id)) problems.push(`Duplicate section id "${s.id}"`);
    sectionIds.add(s.id);
  }
  for (const f of fields) {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(f.name)) problems.push(`Field name "${f.name}" must be alphanumeric camelCase`);
    if (names.has(f.name)) problems.push(`Duplicate field name "${f.name}"`);
    names.set(f.name, f);
    if ((f.type === "select" || f.type === "radio") && f.options.length === 0)
      problems.push(`Field "${f.name}" has no options`);
    if (f.type === "table") {
      const cols = new Set<string>();
      for (const c of f.columns) {
        if (cols.has(c.name)) problems.push(`Duplicate column "${c.name}" in table "${f.name}"`);
        cols.add(c.name);
      }
    }
  }
  const conditions = [
    ...def.sections.filter((s) => s.showIf).map((s) => ({ owner: `section ${s.id}`, cond: s.showIf! })),
    ...fields.filter((f) => f.showIf).map((f) => ({ owner: `field ${f.name}`, cond: f.showIf! })),
  ];
  for (const { owner, cond } of conditions) {
    const target = names.get(cond.field);
    if (!target) problems.push(`${owner} depends on unknown field "${cond.field}"`);
    else if (["table", "photos", "signature", "note", "checklist", "computed", "auto"].includes(target.type))
      problems.push(`${owner} cannot depend on ${target.type} field "${cond.field}"`);
  }
  if (def.outcomeField) {
    const o = names.get(def.outcomeField);
    if (!o || (o.type !== "radio" && o.type !== "select"))
      problems.push(`outcomeField "${def.outcomeField}" must be a radio or select field`);
  }
  if (def.intervalField) {
    const f = names.get(def.intervalField);
    if (!f || f.type !== "number" || !f.required) problems.push(`intervalField "${def.intervalField}" must be a required number field`);
  }
  if (def.nextDueField && names.get(def.nextDueField)?.type !== "auto")
    problems.push(`nextDueField "${def.nextDueField}" must be an auto field`);
  for (const f of fields) {
    if (f.type === "check" && f.number && fields.some((g) => g !== f && g.type === "check" && g.number === f.number))
      problems.push(`Duplicate check item number "${f.number}"`);
  }
  const vd = names.get(def.visitDateField);
  if (!vd || vd.type !== "date" || !vd.required)
    problems.push(`visitDateField "${def.visitDateField}" must be a required date field`);
  return problems;
}
