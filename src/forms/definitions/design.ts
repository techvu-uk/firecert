/**
 * Fire alarm design certificate – based on BS 5839-1:2025 Annex G (Figure G.1),
 * laid out to match TechVu's existing design certificate.
 */
import type { FormDefinition } from "../types";
import { declarationFields, prefillDeclaration, yesNo } from "./shared";

export const designV1: FormDefinition = {
  id: "bs5839-design",
  version: 1,
  title: "Fire Alarm Design Certificate",
  shortTitle: "Design Certificate",
  standard: "BS 5839-1:2025, Annex G Figure G.1",
  description: "Design of a new, extended or modified fire alarm system.",
  visitType: "OTHER",
  scheduleEffect: "none",
  visitDateField: "preparedDate",
  prefill: (ctx) => ({
    preparedDate: ctx.today,
    systemCategory: ctx.site.systemCategory,
    systemDescription: [ctx.site.panelMake, ctx.site.systemType ? `${ctx.site.systemType.toLowerCase()} fire alarm system` : ""].filter(Boolean).join(" "),
    forOnBehalfOf: ctx.company.name,
    soakTest: "NOT_REQUIRED",
    verification: "YES",
    ...prefillDeclaration(ctx),
  }),
  sections: [
    {
      id: "details",
      title: "Certificate details",
      fields: [
        { type: "text", name: "designRef", label: "Certificate reference", placeholder: "e.g. 1903-FA-DES / R01", required: true, width: "half" },
        { type: "date", name: "preparedDate", label: "Prepared", required: true, notFuture: true, width: "half" },
        { type: "text", name: "systemDescription", label: "System", placeholder: "e.g. Ajax EN54 wireless fire alarm system", required: true, width: "half" },
        { type: "text", name: "systemCategory", label: "Category", placeholder: "e.g. L2", required: true, width: "half" },
      ],
    },
    {
      id: "declaration",
      title: "Design declaration",
      fields: [
        ...declarationFields(
          "I, being the competent person responsible, as indicated by my signature below, for the design of the fire detection and fire alarm system described in this certificate, CERTIFY that the design for which I have been responsible complies, to the best of my knowledge and belief, with the recommendations of BS 5839-1:2025, Section 2, for the category stated above, except for any variations recorded below.",
          { customer: "none" },
        ),
        { type: "text", name: "forOnBehalfOf", label: "For and on behalf of", required: true },
      ],
    },
    {
      id: "extent",
      title: "Extent of system and protected areas",
      fields: [{ type: "textarea", name: "extent", label: "Extent of system and protected areas", required: true, rows: 6 }],
    },
    {
      id: "variations",
      title: "Variations from Section 2 recommendations",
      fields: [
        yesNo("hasVariations", "Variations from the recommendations of Section 2"),
        {
          type: "table",
          name: "variationsList",
          label: "Variations",
          required: true,
          minRows: 1,
          numbered: true,
          addLabel: "Add variation",
          showIf: { field: "hasVariations", equals: "YES" },
          columns: [
            { type: "text", name: "clause", label: "Clause" },
            { type: "text", name: "variation", label: "Variation", required: true },
            { type: "text", name: "agreedBy", label: "Agreed with" },
          ],
        },
      ],
    },
    {
      id: "falseAlarms",
      title: "Measures to limit false alarms",
      description: "Designer to select the applicable measures after considering BS 5839-1:2025, Section 3.",
      fields: [
        {
          type: "checklist",
          name: "falseAlarmMeasures",
          label: "Measures specified",
          required: true,
          options: [
            { value: "MCP_SITING", label: "Manual call-point type and siting take account of false-alarm prevention guidance" },
            { value: "DETECTOR_SITING", label: "Automatic detector type, siting and configuration address foreseeable unwanted-alarm sources" },
            { value: "ANALOGUE", label: "An appropriate analogue addressable system is specified" },
            { value: "MULTI_SENSOR", label: "An appropriate multi-sensor system is specified" },
            { value: "TIME_RELATED", label: "Time-related operation is specified" },
            { value: "USER_GUIDANCE", label: "Appropriate guidance is provided to the user to limit false alarms" },
          ],
        },
        { type: "text", name: "timeRelatedDetails", label: "Time-related operation details", placeholder: "Only if time-related operation is specified" },
        { type: "text", name: "otherMeasures", label: "Other measures", placeholder: "e.g. protective covers on call points" },
      ],
    },
    {
      id: "installation",
      title: "Installation, commissioning and verification",
      fields: [
        {
          type: "note",
          name: "installNote",
          label: "Installation and commissioning",
          text: "Installation and commissioning are strongly recommended to follow BS 5839-1:2025, Sections 4 and 5 respectively.",
        },
        {
          type: "radio",
          name: "soakTest",
          label: "Soak test",
          required: true,
          options: [
            { value: "SOAK", label: "A post-commissioning soak period is recommended under 33.5" },
            { value: "NOT_REQUIRED", label: "No soak test is necessary under the standard because the system has no more than 50 automatic detectors" },
          ],
        },
        { type: "number", name: "soakWeeks", label: "Soak period", unit: "weeks", decimals: 0, min: 1, max: 52, required: true, width: "half", showIf: { field: "soakTest", equals: "SOAK" } },
        {
          type: "radio",
          name: "verification",
          label: "Verification that the system complies with BS 5839-1:2025 should be carried out on completion",
          required: true,
          options: [
            { value: "YES", label: "Yes" },
            { value: "NO", label: "No" },
            { value: "TBD", label: "To be decided by purchaser/user" },
          ],
        },
        {
          type: "note",
          name: "maintenanceNote",
          label: "Maintenance and user responsibilities",
          text: "Maintain the system in accordance with BS 5839-1:2025, Section 6. Plan competent servicing approximately every six months, with the next due date based on acceptance. Appoint a member of premises management to supervise system responsibilities under Section 8 (BS 5839-1:2025) and maintain the logbook and user-test arrangements.",
        },
      ],
    },
    {
      id: "references",
      title: "References",
      fields: [
        { type: "text", name: "drawingRef", label: "Drawing reference", width: "third" },
        { type: "text", name: "designSpec", label: "Design specification", width: "third", placeholder: "e.g. L2 fire alarm system design" },
        { type: "text", name: "fraRef", label: "FRA reference", width: "third", placeholder: "e.g. 1062/10/2026, assessed 14 October 2026" },
      ],
    },
  ],
};
