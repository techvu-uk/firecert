# Adding and changing certificate forms

Every certificate is one **form definition**: a TypeScript object describing its sections and fields. The definition automatically drives:

- the engineer's on-screen form (phone and desktop)
- validation (in the browser and again on the server)
- the PDF certificate
- the read-only view and the customer portal

You never write screens or PDF code for a new form.

## Add a new form (e.g. Emergency Lighting)

1. Create `src/forms/definitions/emergency-lighting.ts`:

```ts
import type { FormDefinition } from "../types";
import { check, declarationFields, defectsTable, prefillDeclaration, yesNo } from "./shared";

export const emergencyLightingV1: FormDefinition = {
  id: "bs5266-emergency-lighting",       // permanent: never change once used
  version: 1,
  title: "Emergency Lighting – Periodic Inspection and Test Certificate",
  shortTitle: "Emergency Lighting",
  standard: "BS 5266-1",
  description: "Annual full-duration test and inspection.",
  visitType: "SERVICE",
  scheduleEffect: "none",                 // or "complete-service" to roll the site's service date on
  outcomeField: "result",
  visitDateField: "testDate",
  prefill: (ctx) => ({ testDate: ctx.today, ...prefillDeclaration(ctx) }),
  sections: [
    {
      id: "test",
      title: "Test details",
      fields: [
        { type: "date", name: "testDate", label: "Date of test", required: true, notFuture: true },
        { type: "number", name: "luminaires", label: "Luminaires tested", decimals: 0, min: 0, required: true },
        { type: "select", name: "duration", label: "Test duration", required: true,
          options: [{ value: "1H", label: "1 hour" }, { value: "3H", label: "3 hours" }] },
        check("allOperated", "All luminaires operated for the full rated duration"),
        yesNo("defectsFound", "Defects found"),
        { ...defectsTable(), showIf: { field: "defectsFound", equals: "YES" } },
      ],
    },
    {
      id: "result",
      title: "Result",
      fields: [{ type: "radio", name: "result", label: "Result", required: true, options: [
        { value: "SATISFACTORY", label: "Satisfactory" },
        { value: "UNSATISFACTORY", label: "Unsatisfactory" },
      ] }],
    },
    { id: "declaration", title: "Declaration", fields: declarationFields("I certify that …") },
  ],
};
```

2. Register it in `src/forms/registry.ts`:

```ts
export const ALL_FORMS = [inspectionServicingV1, installationCommissioningV1, remedialWorksV1, emergencyLightingV1];
```

3. Run `npm test`. The test suite checks every registered form for mistakes, such as duplicate field names, conditions pointing at fields that don't exist, or a missing outcome field.

That's it. The form appears in the "Start a certificate" menu straight away.

## Field types

| type | Stores | Notes |
|---|---|---|
| `text`, `textarea` | string | `maxLength`, `placeholder` |
| `number` | number | `min`, `max`, `decimals` (0 = whole numbers), `unit` |
| `date` | `YYYY-MM-DD` | `notFuture` |
| `select`, `radio` | option value | `options: [{ value, label }]` |
| `yesno` | `YES` / `NO` / `NA` | `allowNA` |
| `check` | `{ result: PASS/FAIL/NA/LIM, note }` | Inspection item. `number` (item no.), `style: "tick-cross"` for ✓/✗, `allowLim`. A comment is required on Fail/✗ and LIM. Consecutive checks print as a numbered table. Helper: `item(12, "i12", "…")` |
| `checklist` | array of ticked values | Tick-box list (e.g. documentation handed over) |
| `computed` | string | Worked out from other fields, e.g. false alarm rate: `compute: (data) => …` |
| `auto` | string | Filled in by the system on issue (e.g. next service due), `format: "date" \| "month"` |
| `checkbox` | boolean | `required` means it must be ticked |
| `table` | array of rows | `columns` (text/number/select/date/yesno), `minRows`, `maxRows` |
| `signature` | PNG image | Finger signature |
| `photos` | attachment IDs | Camera upload, shown in a PDF appendix |
| `note` | nothing | Fixed text, e.g. a declaration |

Common options: `required`, `help`, `width: "half" | "third"`, `showIf: { field, equals }` (also works on whole sections), `pdfHidden`.

## Scheduling options

| Option | Meaning |
|---|---|
| `serviceKind` | Which schedule the form belongs to: `FIRE_ALARM` or `EMERGENCY_LIGHTING` (add more in `src/lib/service-kinds.ts`). Each kind has its own due dates and reminders. |
| `scheduleEffect` | `"complete-service"` (closes the due visit and books the next), `"start-schedule"` (new installs) or `"none"` |
| `intervalField` | A required number field holding the months until the next service (e.g. Part 6). Without it, the site's interval is used. |
| `nextDueField` | An `auto` field that receives the next due date when issued, so it prints on the certificate. |

## Current forms

| Form | Based on |
|---|---|
| Design Certificate | BS 5839-1:2025 Annex G Fig. G.1 (TechVu layout) |
| Installation & Commissioning | TechVu layout, sections 1–10 with device schedule |
| Fire Alarm Inspection & Servicing | BS 5839-1:2025 Annex G model, Parts 1–11, items 1–57 |
| Emergency Lighting Inspection | BS 5266-1:2025 Annex M model, Parts 1–11, items 1–19 |
| Fault / Remedial Report | TechVu report |

`scripts/sample-pdfs.ts` renders a sample of each from the example data in `tests/fixtures.ts`. Run it after any layout change.

## Changing a form that's already in use

Issued certificates must always look exactly as they did when issued. So:

- **Safe to edit in place:** wording of labels or help text, adding a new *optional* field, adding a new option to a list.
- **Make a new version for anything else** (removing or renaming fields, making fields required, changing option values):
  1. Copy the file, set `version: 2` and make your changes.
  2. Add the new version to `ALL_FORMS`, and set `retired: true` on version 1.
  3. New certificates use v2. Existing drafts and issued certificates keep using v1.

Never change a form's `id` or an existing field's `name`. Those are the keys the stored data uses.

## Adding a new field *type*

This is rarely needed. Add it to `types.ts`, then handle it in `validate.ts`, `format.ts`, `components/cert-editor/fields.tsx`, and (if it needs special drawing) `server/pdf/certificate-pdf.ts`. Add tests in `tests/forms.test.ts`.
