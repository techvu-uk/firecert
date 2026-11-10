/**
 * Renders a sample PDF of every certificate type from the example data in tests/fixtures.ts.
 * Useful for checking layout changes:  npx tsx --tsconfig tsconfig.json scripts/sample-pdfs.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { getForm } from "../src/forms/registry";
import { validateForm } from "../src/forms/validate";
import type { FormData } from "../src/forms/types";
import { renderCertificatePdf, type PdfMeta } from "../src/server/pdf/certificate-pdf";
import { completeDesign, completeEmergencyLighting, completeInspection, completeInstallation } from "../tests/fixtures";

const sig = { image: readFileSync("scripts/sample-signature.txt", "utf8").trim(), signedAt: "2026-11-03T10:00:00Z" };
const company: PdfMeta["company"] = {
  name: "Techvu Ltd",
  tagline: "Your Gate to Technology",
  addressLines: "30 Harman Court, Rectory Park Avenue, Northolt, UB5 6SS",
  phone: "020 4615 3656",
  mobile: "07491 391228",
  email: "info@techvu.co.uk",
  website: "www.techvu.co.uk",
  companyRegNo: "16940054",
  certificationBody: "",
  certificationNo: "",
};
const watford = {
  customer: { name: "Watford Road Dental Practice / Sana Movahedi", addressLines: "114 Watford Road, Wembley", postcode: "HA0 3HF" },
  site: { name: "Watford Road Dental Practice", addressLines: "114 Watford Road, Wembley", postcode: "HA0 3HF" },
};
const vernon = {
  customer: { name: "Interlet International Lettings & Management Company Ltd", addressLines: "Interlet, 14 Abingdon Road, London", postcode: "W8 6AF" },
  site: { name: "13 Vernon Street", addressLines: "13 Vernon Street, London", postcode: "W14 0RJ" },
};

const jobs: [string, string, FormData, typeof watford, string, Record<string, string>][] = [
  ["design", "bs5839-design", completeDesign, watford, "TV-2026-000101", {}],
  ["installation-commissioning", "bs5839-installation-commissioning", completeInstallation, watford, "TV-2026-000102", { nextServiceDue: "2027-05-03" }],
  ["fire-alarm-inspection-servicing", "bs5839-inspection-servicing", completeInspection, vernon, "TV-2026-000103", { nextServiceDue: "2027-04-27" }],
  ["emergency-lighting-inspection", "bs5266-periodic-inspection", completeEmergencyLighting, vernon, "TV-2026-000104", { nextInspectionDue: "2027-10-27" }],
];

(async () => {
  const out = process.argv[2] ?? "samples";
  mkdirSync(out, { recursive: true });
  for (const [file, formId, data, place, number, auto] of jobs) {
    const def = getForm(formId);
    const res = validateForm(def, { ...data, engineerSignature: sig }, "issue", "2026-11-09");
    if (!res.ok) throw new Error(`${formId}: ${JSON.stringify(res.errors)}`);
    const pdf = await renderCertificatePdf(def, { ...res.data, ...auto }, {
      status: "ISSUED",
      number,
      issuedAt: new Date("2026-11-03T12:00:00Z"),
      company,
      ...place,
      engineer: { name: "Mohamad Kobaisi" },
      photos: [],
    });
    writeFileSync(`${out}/${file}.pdf`, pdf);
    console.log(`${out}/${file}.pdf`);
  }
})();
