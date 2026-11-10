import { describe, expect, it } from "vitest";
import { ALL_FORMS, activeForms, checkDefinition, getForm } from "@/forms/registry";
import { completion, conditionMet, validateForm } from "@/forms/validate";
import { formatValue } from "@/forms/format";
import { completeDesign, completeEmergencyLighting, completeInspection, completeInstallation } from "./fixtures";

const TODAY = "2026-11-09";
const inspection = getForm("bs5839-inspection-servicing");
const el = getForm("bs5266-periodic-inspection");
const design = getForm("bs5839-design");
const install = getForm("bs5839-installation-commissioning");
const field = (def: typeof inspection, name: string) => def.sections.flatMap((s) => s.fields).find((f) => f.name === name)!;

describe("form registry", () => {
  it.each(ALL_FORMS.map((f) => [`${f.id} v${f.version}`, f] as const))("%s definition is valid", (_, def) => {
    expect(checkDefinition(def)).toEqual([]);
  });
  it("has unique id+version pairs", () => {
    const keys = ALL_FORMS.map((f) => `${f.id}@${f.version}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("lists one active version per form", () => {
    const ids = activeForms().map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("throws for unknown forms", () => {
    expect(() => getForm("nope")).toThrow();
    expect(() => getForm(inspection.id, 999)).toThrow();
  });
});

describe("real certificates validate for issue", () => {
  it.each([
    ["inspection & servicing", inspection, completeInspection],
    ["emergency lighting", el, completeEmergencyLighting],
    ["design", design, completeDesign],
    ["installation & commissioning", install, completeInstallation],
  ] as const)("%s", (_, def, data) => {
    const r = validateForm(def, data, "issue", TODAY);
    expect(r.errors).toEqual({});
  });
});

describe("validation", () => {
  it("allows an empty draft but blocks issuing it", () => {
    expect(validateForm(inspection, {}, "draft", TODAY).ok).toBe(true);
    const r = validateForm(inspection, {}, "issue", TODAY);
    expect(r.errors.visitDate).toBe("Required");
    expect(r.errors.engineerSignature).toBe("Signature required");
  });

  it("requires a comment for a failed or limited item", () => {
    const r = validateForm(inspection, { ...completeInspection, i16: { result: "FAIL" }, i17: { result: "LIM" } }, "issue", TODAY);
    expect(r.errors["i16.note"]).toBeDefined();
    expect(r.errors["i17.note"]).toBeDefined();
  });

  it("rejects LIM on items that don't allow it", () => {
    const r = validateForm(el, { ...completeEmergencyLighting, e10: { result: "LIM", note: "x" } }, "issue", TODAY);
    expect(r.errors.e10).toBeDefined();
  });

  it("only requires items for the parts in scope", () => {
    const noAnnual = { ...completeInspection, scopeAnnual: "NO", scopeSpecial: "NA" };
    for (let n = 26; n <= 57; n++) delete (noAnnual as Record<string, unknown>)[`i${n}`];
    const r = validateForm(inspection, noAnnual, "issue", TODAY);
    expect(r.errors).toEqual({});
    expect(r.data.i26).toBeUndefined();
    const missing = validateForm(inspection, { ...noAnnual, scopeAnnual: "YES" }, "issue", TODAY);
    expect(missing.errors.i26).toBe("Required");
  });

  it("caps the fire alarm service interval at 6 months", () => {
    const r = validateForm(inspection, { ...completeInspection, nextInspectionMonths: 12 }, "issue", TODAY);
    expect(r.errors.nextInspectionMonths).toMatch(/no more than 6/);
  });

  it("calculates the false alarm rate", () => {
    const r = validateForm(inspection, { ...completeInspection, falseAlarms12m: 3, automaticDetectors: 40 }, "issue", TODAY);
    expect(r.data.falseAlarmRate).toBe("7.5");
    const m = validateForm(inspection, { ...completeInspection, systemCategory: "M" }, "issue", TODAY);
    expect(m.data.falseAlarmRate).toBe("N/A");
  });

  it("ignores attempts to set system-filled fields", () => {
    const r = validateForm(inspection, { ...completeInspection, nextServiceDue: "2030-01-01" }, "issue", TODAY);
    expect(r.data.nextServiceDue).toBeUndefined();
  });

  it("validates checklists", () => {
    const empty = validateForm(install, { ...completeInstallation, documentation: [] }, "issue", TODAY);
    expect(empty.errors.documentation).toBeDefined();
    const junk = validateForm(install, { ...completeInstallation, documentation: ["LOGBOOK", "HACK", "LOGBOOK"] }, "issue", TODAY);
    expect(junk.data.documentation).toEqual(["LOGBOOK"]);
  });

  it("requires soak weeks only when a soak test is recommended", () => {
    const r = validateForm(design, { ...completeDesign, soakTest: "SOAK" }, "issue", TODAY);
    expect(r.errors.soakWeeks).toBe("Required");
  });

  it("validates device schedule rows", () => {
    const r = validateForm(install, { ...completeInstallation, devices: [{ deviceId: "01" }] }, "issue", TODAY);
    expect(r.errors["devices.0.deviceType"]).toBe("Required");
    expect(r.errors["devices.0.location"]).toBe("Required");
    expect(validateForm(install, { ...completeInstallation, devices: [] }, "issue", TODAY).errors.devices).toBeDefined();
  });

  it("rejects future dates, impossible dates and bad numbers", () => {
    const r = validateForm(inspection, { ...completeInspection, visitDate: "2099-01-01", falseAlarms12m: 1.5, batteryChargeVoltage: "abc" }, "issue", TODAY);
    expect(r.errors.visitDate).toMatch(/future/);
    expect(r.errors.falseAlarms12m).toMatch(/whole/);
    expect(r.errors.batteryChargeVoltage).toBeDefined();
    expect(validateForm(design, { ...completeDesign, preparedDate: "2026-02-30" }, "draft", TODAY).errors.preparedDate).toBeDefined();
  });

  it("rejects options that are not in the list", () => {
    expect(validateForm(inspection, { ...completeInspection, overallCondition: "MAYBE" }, "draft", TODAY).errors.overallCondition).toBeDefined();
  });

  it("requires remedial rows only when remedial work is needed", () => {
    const missing = validateForm(inspection, { ...completeInspection, remedialWork: "REQUIRED" }, "issue", TODAY);
    expect(missing.errors.remedialItems).toBeDefined();
  });

  it("strips hidden fields when issuing but keeps them in drafts", () => {
    const data = { ...completeInspection, remedialWork: "NONE", remedialItems: [{ description: "x" }] };
    expect(validateForm(inspection, data, "issue", TODAY).data.remedialItems).toBeUndefined();
    expect(validateForm(inspection, data, "draft", TODAY).data.remedialItems).toBeDefined();
  });

  it("drops unknown keys", () => {
    expect(validateForm(inspection, { ...completeInspection, hacker: "x" }, "issue", TODAY).data.hacker).toBeUndefined();
  });

  it("requires a second signature only when a second signatory is added", () => {
    const r = validateForm(el, { ...completeEmergencyLighting, hasSecondSignatory: true }, "issue", TODAY);
    expect(r.errors.engineer2Signature).toBeDefined();
  });

  it("rejects non-PNG signature data", () => {
    const r = validateForm(inspection, { ...completeInspection, engineerSignature: { image: "javascript:alert(1)", signedAt: "" } }, "issue", TODAY);
    expect(r.errors.engineerSignature).toBeDefined();
  });

  it("reports completion progress", () => {
    expect(completion(inspection, {}, TODAY).done).toBe(0);
    const full = completion(inspection, completeInspection, TODAY);
    expect(full.done).toBe(full.total);
  });
});

describe("conditions & formatting", () => {
  it("treats unset checkboxes as false", () => {
    expect(conditionMet({ field: "x", equals: false }, {})).toBe(true);
    expect(conditionMet({ field: "x", equals: ["A", "B"] }, { x: "B" })).toBe(true);
  });
  it("formats values for display", () => {
    expect(formatValue(field(inspection, "visitDate"), "2026-11-09")).toBe("09/11/2026");
    expect(formatValue(field(inspection, "i02"), { result: "PASS" })).toBe("✓");
    expect(formatValue(field(install, "controlPanel"), { result: "PASS" })).toBe("Pass");
    expect(formatValue(field(install, "nextServiceDue"), "2027-05-03")).toBe("May 2027");
    expect(formatValue(field(install, "documentation"), ["LOGBOOK", "KEYS"])).toBe("Log book provided; Keys / access codes handed over");
  });
});
