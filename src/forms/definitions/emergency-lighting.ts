/**
 * Emergency lighting system – Periodic Inspection and Testing Certificate.
 * Structure follows the model in Annex M of BS 5266-1:2025 (Parts 1–11), with routine
 * inspection and test items from BS EN 50172:2024. Item wording is our own summary.
 */
import type { FormDefinition } from "../types";
import { clientFields, declarationFields, item, prefillClient, prefillDeclaration, yesNo } from "./shared";

const LEGEND = "✓ = assessed and satisfactory, ✗ = variation identified (record in Part 4), N/A = not applicable.";

export const emergencyLightingV1: FormDefinition = {
  id: "bs5266-periodic-inspection",
  version: 1,
  title: "Emergency Lighting System Periodic Inspection and Testing Certificate",
  subtitle: "Certifying continued compliance of an existing emergency lighting installation",
  shortTitle: "Emergency Lighting Inspection",
  standard: "BS 5266-1:2025, BS EN 1838:2024 and BS EN 50172:2024",
  description: "Periodic inspection and test of an existing emergency lighting installation (normally annual).",
  visitType: "SERVICE",
  serviceKind: "EMERGENCY_LIGHTING",
  scheduleEffect: "complete-service",
  intervalField: "nextInspectionMonths",
  nextDueField: "nextInspectionDue",
  outcomeField: "overallResult",
  visitDateField: "visitDate",
  prefill: (ctx) => ({
    ...prefillClient(ctx),
    visitDate: ctx.today,
    nextInspectionMonths: 12,
    inspAnnual: "YES",
    inspMonthly: "NO",
    inspDaily: "NO",
    inspFiveYear: "NO",
    classification: [{}],
    ...prefillDeclaration(ctx),
  }),
  sections: [
    {
      id: "part1",
      title: "Part 1: Client and installation",
      fields: [...clientFields()],
    },
    {
      id: "part2",
      title: "Part 2: Installation covered by this certificate",
      fields: [
        { type: "date", name: "visitDate", label: "Date of inspection and test", required: true, notFuture: true, width: "half" },
        { type: "textarea", name: "extent", label: "Description and extent of the installation covered by this certificate", required: true, rows: 2, placeholder: "e.g. HMO – common parts" },
      ],
    },
    {
      id: "part3",
      title: "Part 3: Certification",
      fields: [
        ...declarationFields(
          "I/We certify that the emergency lighting system described in Part 2 has been inspected and tested in accordance with the results of the inspection and testing recorded in this certificate, and that to the best of my/our knowledge and belief the installation conforms to the recommendations and requirements of BS 5266-1:2025, BS EN 1838:2024 and BS EN 50172:2024, except for the variations, if any, recorded in Part 4.",
          { customer: "none" },
        ),
        { type: "checkbox", name: "hasSecondSignatory", label: "Add a second signatory", pdfHidden: true },
        { type: "text", name: "engineer2Name", label: "Second signatory name", required: true, width: "half", showIf: { field: "hasSecondSignatory", equals: true } },
        { type: "text", name: "engineer2Position", label: "Position", width: "half", showIf: { field: "hasSecondSignatory", equals: true } },
        { type: "signature", name: "engineer2Signature", label: "Second signatory signature", required: true, width: "half", showIf: { field: "hasSecondSignatory", equals: true } },
        { type: "date", name: "engineer2Date", label: "Date", required: true, notFuture: true, width: "half", showIf: { field: "hasSecondSignatory", equals: true } },
      ],
    },
    {
      id: "part4",
      title: "Part 4: Variations from BS 5266-1 and BS EN 50172",
      fields: [
        yesNo("hasVariations", "Variations from the recommendations and requirements"),
        {
          type: "table",
          name: "variations",
          label: "Details of the variations",
          required: true,
          minRows: 1,
          maxRows: 100,
          addLabel: "Add variation",
          showIf: { field: "hasVariations", equals: "YES" },
          columns: [
            { type: "text", name: "clause", label: "Clause no." },
            { type: "text", name: "details", label: "Details of the variation", required: true },
          ],
        },
        {
          type: "radio",
          name: "overallResult",
          label: "Overall result",
          required: true,
          options: [
            { value: "SATISFACTORY", label: "Satisfactory – installation complies" },
            { value: "SATISFACTORY_VARIATIONS", label: "Satisfactory with variations recorded" },
            { value: "UNSATISFACTORY", label: "Unsatisfactory – remedial work required" },
          ],
        },
        { type: "photos", name: "photos", label: "Photos", maxPhotos: 12 },
      ],
    },
    {
      id: "part5",
      title: "Part 5: Related reference documents",
      fields: [
        { type: "text", name: "eicrReportNo", label: "Most recent EICR covering the emergency lighting – report no.", width: "half", placeholder: "N/A" },
        { type: "date", name: "eicrDate", label: "EICR date", width: "half" },
        { type: "text", name: "otherDocuments", label: "Other documents (if any)", width: "half", placeholder: "N/A" },
        { type: "text", name: "otherDocumentsRef", label: "Reference no.", width: "half", placeholder: "N/A" },
      ],
    },
    {
      id: "part6",
      title: "Part 6: Next inspection",
      fields: [
        {
          type: "number",
          name: "nextInspectionMonths",
          label: "Recommended interval until the next inspection and test",
          unit: "months",
          decimals: 0,
          min: 1,
          max: 12,
          required: true,
          width: "half",
        },
        { type: "auto", name: "nextInspectionDue", label: "Next inspection due", format: "date", width: "half" },
      ],
    },
    {
      id: "part7",
      title: "Part 7: Installed emergency lighting system",
      fields: [
        {
          type: "checklist",
          name: "purpose",
          label: "Purpose of emergency lighting",
          required: true,
          options: [
            { value: "ESCAPE", label: "Emergency escape lighting" },
            { value: "LOCAL_AREA", label: "Emergency local area lighting" },
            { value: "STANDBY", label: "Standby lighting" },
            { value: "OPEN_AREA", label: "Open area (anti-panic) lighting" },
            { value: "HIGH_RISK", label: "High-risk task area lighting" },
          ],
        },
        {
          type: "checklist",
          name: "arrangement",
          label: "Arrangement of emergency lighting",
          required: true,
          options: [
            { value: "SELF_CONTAINED", label: "Self-contained emergency lighting" },
            { value: "CENTRAL_BATTERY", label: "Central battery system" },
            { value: "COMBINED", label: "Combined emergency luminaire" },
            { value: "GENERATOR", label: "Standby generator" },
            { value: "OTHER", label: "Other (state below)" },
          ],
        },
        { type: "text", name: "arrangementOther", label: "Other arrangement (state)", placeholder: "N/A" },
        yesNo("autoTestSystem", "Automatic test system fitted"),
        {
          type: "table",
          name: "classification",
          label: "Classification of operation (Annex F of BS 5266-1:2025)",
          required: true,
          minRows: 1,
          maxRows: 10,
          addLabel: "Add classification",
          columns: [
            {
              type: "select",
              name: "type",
              label: "Type",
              required: true,
              options: ["Self-contained", "Central battery", "Generator", "Other"].map((v) => ({ value: v, label: v })),
            },
            {
              type: "select",
              name: "mode",
              label: "Mode",
              required: true,
              options: ["Maintained", "Non-maintained", "Combined", "Sustained"].map((v) => ({ value: v, label: v })),
            },
            {
              type: "select",
              name: "facilities",
              label: "Facilities",
              required: true,
              options: ["Manual test", "Self-test", "Automatic test system", "Remote rest mode", "Inhibiting mode"].map((v) => ({ value: v, label: v })),
            },
            {
              type: "select",
              name: "duration",
              label: "Duration",
              required: true,
              options: ["1 hour", "2 hours", "3 hours"].map((v) => ({ value: v, label: v })),
            },
          ],
        },
        { type: "textarea", name: "modifications", label: "Additions or modifications to the system or premises since the original installation", rows: 2, placeholder: "N/A" },
      ],
    },
    {
      id: "part8scope",
      title: "Part 8: Results of inspection and testing",
      description:
        "Warning: full duration tests discharge the batteries and the system will not be fully functional until they have recharged. Test at times of minimal risk, or test alternate luminaires only.",
      fields: [
        yesNo("inspDaily", "Daily inspection recorded in this certificate", { width: "half" }),
        yesNo("inspMonthly", "Monthly inspection and test", { width: "half" }),
        yesNo("inspAnnual", "Annual inspection and test", { width: "half" }),
        yesNo("inspFiveYear", "Five-yearly verification", { width: "half" }),
      ],
    },
    {
      id: "part8daily",
      title: "Daily inspection (BS EN 50172 clause 7.4.2)",
      description: LEGEND,
      showIf: { field: "inspDaily", equals: "YES" },
      fields: [
        item(1, "e01", "Central power supply status indicators visually checked for correct operation"),
        item(2, "e02", "Self-contained emergency luminaires: visual check, or central monitoring used"),
        item(3, "e03", "Faults and corrective actions from the daily inspection recorded"),
      ],
    },
    {
      id: "part8monthly",
      title: "Monthly inspection and test (BS EN 50172 clause 7.4.3)",
      description: `In addition to the daily inspection. ${LEGEND}`,
      showIf: { field: "inspMonthly", equals: "YES" },
      fields: [
        item(4, "e04", "Each luminaire switched to emergency mode by simulating failure of the normal supply, long enough to confirm the lamps operate"),
        item(5, "e05", "All emergency luminaires and externally illuminated safety signs checked as present and working"),
        item(6, "e06", "At the end of the test period, supply restored and indicators checked"),
        item(7, "e07", "Automatic test system status verified"),
        item(8, "e08", "Correct operation of system monitors verified"),
        item(9, "e09", "Results recorded in the logbook"),
      ],
    },
    {
      id: "part8annual",
      title: "Annual inspection and test (BS EN 50172 clause 7.4.4)",
      description: LEGEND,
      showIf: { field: "inspAnnual", equals: "YES" },
      fields: [
        item(10, "e10", "Full rated-duration test of each emergency luminaire carried out by simulating failure of the normal supply"),
        item(11, "e11", "All emergency luminaires and externally illuminated safety signs visually inspected (location, orientation, damage, dirt and dust)"),
        item(12, "e12", "At the end of the full-duration test, supply restored and indicators verified; status indicators or remote displays of any automatic test system checked"),
        item(13, "e13", "Central system monitors and indicators verified"),
        item(14, "e14", "Correct operation of inhibit and rest modes verified (IEC/EN 60598-2-22), where applicable"),
        item(15, "e15", "No obstructions likely to impede the visibility of safety signs"),
        item(16, "e16", "Results recorded in the logbook"),
        item(17, "e17", "Precautions taken during the recharge period (testing when the building is unoccupied, or alternate luminaires tested)"),
      ],
    },
    {
      id: "part8fiveyear",
      title: "Five-yearly verification (BS EN 50172 clause 7.4.5)",
      description: `In addition to the annual inspection and test. ${LEGEND}`,
      showIf: { field: "inspFiveYear", equals: "YES" },
      fields: [
        item(18, "e18", "Photometric test confirming illumination levels meet BS EN 1838, as used for the original design"),
        item(19, "e19", "Results recorded in the logbook"),
      ],
    },
    {
      id: "part9",
      title: "Part 9: Test instruments used",
      description: "Where item 18 is carried out by measurement, instrument details must be recorded.",
      fields: [
        { type: "text", name: "lightMeterModel", label: "Light meter – model", width: "half", placeholder: "N/A" },
        { type: "text", name: "lightMeterSerial", label: "Light meter – serial no.", width: "half", placeholder: "N/A" },
        { type: "text", name: "otherInstrumentModel", label: "Other instrument – model", width: "half", placeholder: "N/A" },
        { type: "text", name: "otherInstrumentSerial", label: "Other instrument – serial no.", width: "half", placeholder: "N/A" },
      ],
    },
    {
      id: "part11",
      title: "Part 11: Alternative method used to verify illumination",
      fields: [{ type: "textarea", name: "alternativeMethod", label: "Where applicable", rows: 2, placeholder: "N/A" }],
    },
  ],
  pdfFooterNotes: [
    "This certificate confirms the periodic inspection and testing of an existing emergency lighting installation in accordance with BS 5266-1. It is not for use on a new installation, new work associated with an alteration or addition, or where no previous documentation exists.",
    "Keep this certificate in a safe place with the emergency lighting logbook and show it to anyone who later inspects, tests or alters the installation. Daily, monthly and annual checks should be carried out and recorded in the logbook as recommended in BS 5266-1 and BS EN 50172.",
    "If a fault is found: contact a competent person to put it right, carry out a risk assessment of the failure, and consider temporary measures (warning occupants, extra safety patrols, torches, or restricting use of the affected area) until it is fixed.",
  ],
};
