import type { FormDefinition } from "../types";
import {
  DEFECT_PRIORITIES,
  declarationFields,
  leftInServiceFields,
  prefillDeclaration,
  prefillSystem,
  systemFields,
  yesNo,
} from "./shared";

export const remedialWorksV1: FormDefinition = {
  id: "fire-alarm-remedial-report",
  version: 1,
  title: "Fire Alarm System – Fault and Remedial Works Report",
  shortTitle: "Fault / Remedial Report",
  standard: "BS 5839-1:2025",
  description: "Fault call-out, remedial works or false alarm investigation.",
  visitType: "REMEDIAL",
  scheduleEffect: "none",
  outcomeField: "result",
  visitDateField: "visitDate",
  prefill: (ctx) => ({
    visitDate: ctx.today,
    ...prefillSystem(ctx),
    ...prefillDeclaration(ctx),
  }),
  sections: [
    {
      id: "visit",
      title: "Visit details",
      fields: [
        { type: "text", name: "jobReference", label: "Job / project reference", width: "half" },
        { type: "date", name: "visitDate", label: "Date of visit", required: true, notFuture: true, width: "half" },
        {
          type: "select",
          name: "reason",
          label: "Reason for visit",
          required: true,
          width: "half",
          options: [
            { value: "FAULT", label: "Fault call-out" },
            { value: "REMEDIAL", label: "Remedial works from inspection" },
            { value: "FALSE_ALARM", label: "False alarm investigation" },
            { value: "OTHER", label: "Other" },
          ],
        },
        { type: "textarea", name: "reportedProblem", label: "Problem reported by customer", rows: 2 },
        ...systemFields(),
      ],
    },
    {
      id: "works",
      title: "Findings and works carried out",
      fields: [
        { type: "textarea", name: "findings", label: "Findings / fault diagnosis", required: true, rows: 4 },
        {
          type: "table",
          name: "worksCarriedOut",
          label: "Works carried out",
          required: true,
          minRows: 1,
          maxRows: 100,
          addLabel: "Add item",
          columns: [
            { type: "text", name: "location", label: "Location / device" },
            { type: "text", name: "action", label: "Action taken", required: true },
            { type: "text", name: "parts", label: "Parts used" },
            { type: "number", name: "qty", label: "Qty", decimals: 0, min: 0, max: 9999 },
          ],
        },
        { type: "photos", name: "photos", label: "Photos", maxPhotos: 12 },
      ],
    },
    {
      id: "outstanding",
      title: "Outstanding items",
      fields: [
        yesNo("hasOutstanding", "Items still outstanding after this visit"),
        {
          type: "table",
          name: "outstandingItems",
          label: "Outstanding items",
          required: true,
          minRows: 1,
          maxRows: 100,
          addLabel: "Add item",
          showIf: { field: "hasOutstanding", equals: "YES" },
          columns: [
            { type: "text", name: "description", label: "Description", required: true },
            { type: "select", name: "priority", label: "Priority", options: DEFECT_PRIORITIES, required: true },
            { type: "text", name: "recommendation", label: "Recommendation" },
          ],
        },
      ],
    },
    {
      id: "result",
      title: "Result",
      fields: [
        {
          type: "radio",
          name: "result",
          label: "Result",
          required: true,
          options: [
            { value: "RESOLVED", label: "All faults rectified – system operational" },
            { value: "PARTIAL", label: "Partially rectified – further work required" },
            { value: "NOT_RESOLVED", label: "Not rectified – system impaired" },
          ],
        },
        ...leftInServiceFields(),
      ],
    },
    {
      id: "declaration",
      title: "Declaration",
      fields: declarationFields(
        "I confirm that the works described above have been carried out and that the system has been left in the condition stated.",
      ),
    },
  ],
};
