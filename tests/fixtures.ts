/**
 * Complete example data for each certificate, taken from real TechVu certificates.
 * Used by the unit tests and by scripts/sample-pdfs.ts.
 */
import type { FormData } from "@/forms/types";

// Small PNG stand-in for a signature
export const SIG = {
  image:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  signedAt: "2026-10-27T10:00:00.000Z",
};

const ok = { result: "PASS" };
const na = { result: "NA" };
const items = (prefix: string, from: number, to: number, naList: number[] = []) =>
  Object.fromEntries(
    Array.from({ length: to - from + 1 }, (_, i) => from + i).map((n) => [
      `${prefix}${String(n).padStart(2, "0")}`,
      naList.includes(n) ? na : ok,
    ]),
  );

/** NICEIC FSM25-style fire alarm inspection – 13 Vernon Street, W14 0RJ (27/10/2026) */
export const completeInspection: FormData = {
  jobReference: "",
  clientReference: "00078",
  occupier: "Interlet International Lettings & Management Company Ltd",
  visitDate: "2026-10-27",
  visitKind: "ROUTINE",
  extent: "HMO property – fire alarm test",
  agreedLimitations: "N/A",
  systemCategory: "L2",
  systemType: "Conventional",
  zoneCount: 4,
  panelMake: "C-TEC",
  panelModel: "CFP704",
  panelLocation: "Ground floor entrance hall",
  arcConnected: "NO",
  scopeBatteries: "NA",
  scopePeriodic: "YES",
  scopeAnnual: "YES",
  scopeSpecial: "YES",
  variations: "N/A",
  overallCondition: "SATISFACTORY",
  engineerName: "MOHAMAD KOBAISI",
  engineerPosition: "Technical Eng.",
  engineerSignature: SIG,
  engineerSignedDate: "2026-10-27",
  customerUnavailable: true,
  remedialWork: "NONE",
  photos: [],
  generalCondition: "Satisfactory, OK for continued use",
  defectsReported: "NA",
  logbookUpdated: "NA",
  falseAlarms12m: 0,
  automaticDetectors: 18,
  nextInspectionMonths: 6,
  refDesignSpec: "N/A",
  refPreviousInspection: "N/A",
  ...items("i", 2, 25, [11, 18, 21, 22, 23, 25]),
  batteryChargeVoltage: 28.4,
  ...items("i", 26, 40, [33, 34]),
  ...items("i", 41, 57, [41, 45, 56]),
};

/** NICEIC EPM25-style emergency lighting inspection – 13 Vernon Street, W14 0RJ (27/10/2026) */
export const completeEmergencyLighting: FormData = {
  clientReference: "",
  occupier: "Interlet International Lettings & Management Company Ltd",
  visitDate: "2026-10-27",
  extent: "HMO – common parts",
  engineerName: "MOHAMAD KOBAISI",
  engineerPosition: "Technical ENG.",
  engineerSignature: SIG,
  engineerSignedDate: "2026-10-27",
  hasSecondSignatory: false,
  hasVariations: "NO",
  overallResult: "SATISFACTORY",
  photos: [],
  eicrReportNo: "N/A",
  otherDocuments: "N/A",
  nextInspectionMonths: 12,
  purpose: ["ESCAPE", "HIGH_RISK"],
  arrangement: ["SELF_CONTAINED"],
  arrangementOther: "N/A",
  autoTestSystem: "NO",
  classification: [{ type: "Self-contained", mode: "Maintained", facilities: "Manual test", duration: "3 hours" }],
  modifications: "N/A",
  inspDaily: "NO",
  inspMonthly: "NO",
  inspAnnual: "YES",
  inspFiveYear: "NO",
  ...items("e", 10, 17, [13, 15, 17]),
  lightMeterModel: "N/A",
  lightMeterSerial: "N/A",
  alternativeMethod: "N/A",
};

/** TechVu design certificate 1903-FA-DES / R01 – Watford Road Dental Practice */
export const completeDesign: FormData = {
  designRef: "1903-FA-DES / R01",
  preparedDate: "2026-11-03",
  systemDescription: "Ajax EN54 wireless fire alarm system",
  systemCategory: "L2",
  engineerName: "MOHAMAD KOBAISI",
  engineerPosition: "Director",
  engineerSignature: SIG,
  engineerSignedDate: "2026-11-03",
  forOnBehalfOf: "Techvu Ltd",
  extent:
    "Ground-floor dental surgery: surgery rooms 1, 2 and 3; reception; staff room; decontamination room; associated circulation and entrance areas; and an additional smoke detector inside the under-stair electrical cupboard, manual call points and associated alarm sounders.\nFirst-floor flat interface: a heat detector with sounder and a manual call point on the main entrance.",
  hasVariations: "NO",
  falseAlarmMeasures: ["MCP_SITING", "DETECTOR_SITING", "ANALOGUE", "USER_GUIDANCE"],
  otherMeasures: "Protective covers on call points",
  soakTest: "NOT_REQUIRED",
  verification: "YES",
  drawingRef: "1903-FA-DES / R01",
  designSpec: "L2 fire alarm system design",
  fraRef: "1062/10/2026, assessed 14 October 2026",
};

const device = (deviceId: string, deviceType: string, location: string, zone: string) => ({
  deviceId,
  deviceType,
  location,
  zone,
  result: "PASS",
  comments: "",
});

/** TechVu installation & commissioning certificate 1903-FA – Watford Road Dental Practice */
export const completeInstallation: FormData = {
  jobReference: "1903-FA",
  contactName: "Sana Movahedi",
  contactNumber: "+44 7832 113635",
  systemType: "Wireless",
  standard: "BS 5839-1",
  systemCategory: "L2 – Grade A",
  panelMakeModel: "Ajax EN54",
  panelLocation: "Surgery main entrance",
  powerSupply: "72H lithium battery",
  engineerName: "MOHAMAD KOBAISI",
  completionDate: "2026-11-03",
  scope: "Dental surgery with a flat on the first floor.",
  installCompany: "Techvu Ltd",
  installEngineer: "Mohamad Kobaisi",
  installDate: "2026-11-03",
  commissioningChecks: ["PANEL", "DEVICE_ID", "ALARM", "MCP", "DETECTOR", "SOUNDER", "FAULT", "BATTERY", "ZONE_TEXT", "CAUSE_EFFECT", "AUDIBILITY", "HANDOVER"],
  commissioningEngineer: "Mohamad Kobaisi",
  commissioningDate: "2026-11-03",
  commissioningComments: "N/A",
  devices: [
    device("01", "Heat detector", "Surgery room 3", "1"),
    device("02", "Heat detector / sounder", "Surgery room 1", "1"),
    device("03", "Heat detector / sounder", "Surgery room 2", "1"),
    device("04", "Manual call point", "Reception", "1"),
    device("05", "Smoke detector", "Reception", "1"),
    device("06", "Smoke detector / sounder", "Staff room", "1"),
    device("07", "Smoke detector / sounder", "Main building entrance", "1"),
    device("08", "Smoke detector / sounder", "Surgery entrance", "1"),
    device("09", "Smoke detector", "Small hallway next to surgery room 2", "1"),
    device("10", "Heat detector", "Decon room", "1"),
    device("11", "Manual call point", "Decon room", "1"),
    device("12", "Manual call point", "First floor flat entrance", "2"),
    device("13", "Heat detector / sounder", "First floor flat", "2"),
    device("14", "Smoke detector", "Electric cupboard", "1"),
  ],
  controlPanel: ok,
  devicesIdentified: ok,
  callPointsTested: ok,
  detectorsTested: ok,
  soundersOperated: ok,
  faultMonitoring: ok,
  supplyVerified: ok,
  systemOperational: "OPERATIONAL",
  documentation: ["ZONE_CHART", "LOGBOOK", "USER_INSTRUCTIONS", "DEVICE_LIST", "BATTERY_INFO", "OPERATING_EXPLAINED", "KEYS", "WEEKLY_TEST"],
  observations:
    "System installed and left operational at the time of handover.\nA zonal location drawing is provided adjacent to the operating panel.\nBattery replacement due November 2031.",
  photos: [],
  signedName: "Mohamad Kobaisi",
  signedDate: "2026-11-03",
  engineerSignature: SIG,
  forOnBehalfOf: "Techvu Ltd",
  customerUnavailable: true,
};
