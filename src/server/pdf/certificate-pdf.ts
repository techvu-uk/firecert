/**
 * Generates certificate PDFs from a FormDefinition + stored data.
 * Generic: any new form definition renders automatically, no PDF code changes needed.
 */
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { degrees, PDFDocument, PDFFont, PDFImage, PDFPage, rgb, type RGB } from "pdf-lib";
import { formatDate, formatValue, outcomeTone } from "@/forms/format";
import type { CheckField, CheckValue, ChecklistField, Field, FormData, FormDefinition, SignatureValue, TableField } from "@/forms/types";
import { conditionMet } from "@/forms/validate";

export interface PdfMeta {
  status: "DRAFT" | "ISSUED" | "VOID";
  number: string | null;
  issuedAt: Date | null;
  company: {
    name: string;
    addressLines: string;
    phone: string;
    email: string;
    website: string;
    certificationBody: string;
    certificationNo: string;
    tagline?: string;
    companyRegNo?: string;
    mobile?: string;
  };
  customer: { name: string; addressLines: string; postcode: string };
  site: { name: string; addressLines: string; postcode: string };
  engineer: { name: string };
  photos: { id: string; bytes: Uint8Array; mimeType: string }[];
}

// ---- Page geometry & palette ------------------------------------------------
const A4 = { w: 595.28, h: 841.89 };
const M = 36; // margin
const CONTENT_W = A4.w - M * 2;
const FOOTER_H = 28;
const C = {
  ink: rgb(0.09, 0.1, 0.13),
  muted: rgb(0.39, 0.43, 0.49),
  line: rgb(0.85, 0.87, 0.9),
  band: rgb(0.95, 0.96, 0.97),
  brand: rgb(0.79, 0.16, 0.16),
  good: rgb(0.1, 0.5, 0.25),
  warn: rgb(0.72, 0.45, 0.02),
  bad: rgb(0.79, 0.16, 0.16),
  white: rgb(1, 1, 1),
  navy: rgb(0.11, 0.24, 0.42),
};

let fontCache: { regular: Uint8Array; bold: Uint8Array } | null = null;
async function loadFonts() {
  if (!fontCache) {
    const dir = path.join(process.cwd(), "assets", "fonts");
    const [regular, bold] = await Promise.all([
      readFile(path.join(dir, "LiberationSans-Regular.ttf")),
      readFile(path.join(dir, "LiberationSans-Bold.ttf")),
    ]);
    fontCache = { regular: new Uint8Array(regular), bold: new Uint8Array(bold) };
  }
  return fontCache;
}

/** Removes characters the font can't draw (emoji, control chars) so generation never fails. */
function clean(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ")
    .replace(/[\u2713\u2714\u2611]/g, "Yes")
    .replace(/[\u2717\u2718\u2612]/g, "X")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, "");
}

class Layout {
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];

  constructor(
    private doc: PDFDocument,
    public font: PDFFont,
    public bold: PDFFont,
    private onNewPage: (l: Layout, first: boolean) => void,
  ) {}

  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.pages.push(this.page);
    this.y = A4.h - M;
    this.onNewPage(this, this.pages.length === 1);
  }

  /** Ensures `h` points of space remain, else starts a new page. Returns true if a page break happened. */
  ensure(h: number): boolean {
    if (this.y - h < M + FOOTER_H) {
      this.newPage();
      return true;
    }
    return false;
  }

  wrap(text: string, size: number, width: number, f: PDFFont = this.font): string[] {
    const out: string[] = [];
    for (const para of clean(text).split("\n")) {
      const words = para.split(/ +/);
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(candidate, size) <= width) {
          line = candidate;
          continue;
        }
        if (line) out.push(line);
        // Hard-break words longer than the column
        let w = word;
        while (f.widthOfTextAtSize(w, size) > width && w.length > 1) {
          let i = w.length - 1;
          while (i > 1 && f.widthOfTextAtSize(w.slice(0, i), size) > width) i--;
          out.push(w.slice(0, i));
          w = w.slice(i);
        }
        line = w;
      }
      out.push(line);
    }
    return out;
  }

  text(s: string, x: number, y: number, size: number, opts: { font?: PDFFont; color?: RGB } = {}) {
    this.page.drawText(clean(s), { x, y, size, font: opts.font ?? this.font, color: opts.color ?? C.ink });
  }

  lines(lines: string[], x: number, yTop: number, size: number, opts: { font?: PDFFont; color?: RGB } = {}) {
    lines.forEach((ln, i) => this.text(ln, x, yTop - size - i * (size + 2.5), size, opts));
  }

  rect(x: number, y: number, w: number, h: number, color: RGB, border?: RGB) {
    this.page.drawRectangle({ x, y, width: w, height: h, color, borderColor: border, borderWidth: border ? 0.6 : 0 });
  }

  hline(y: number, x1 = M, x2 = A4.w - M, color = C.line) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.6, color });
  }
}

const lineH = (size: number) => size + 2.5;

export async function renderCertificatePdf(def: FormDefinition, data: FormData, meta: PdfMeta): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts = await loadFonts();
  const font = await doc.embedFont(fonts.regular, { subset: true });
  const bold = await doc.embedFont(fonts.bold, { subset: true });

  const title = def.title;
  const numberText = meta.number ?? "DRAFT – NOT VALID";
  doc.setTitle(`${def.shortTitle} ${meta.number ?? "Draft"} – ${meta.site.name}`);
  doc.setAuthor(meta.company.name);
  doc.setSubject(title);
  doc.setCreator("FireCert");
  doc.setProducer("FireCert");
  if (meta.issuedAt) doc.setCreationDate(meta.issuedAt);

  const L = new Layout(doc, font, bold, (l, first) => {
    if (first) drawFirstHeader(l, def, meta, numberText);
    else drawRunningHeader(l, def, numberText);
  });
  L.newPage();

  // Embed signature images once
  const sigImages = new Map<string, PDFImage>();
  for (const f of def.sections.flatMap((s) => s.fields)) {
    if (f.type !== "signature") continue;
    const sig = data[f.name] as SignatureValue | undefined;
    if (!sig?.image) continue;
    try {
      const b64 = sig.image.split(",")[1] ?? "";
      sigImages.set(f.name, await doc.embedPng(Buffer.from(b64, "base64")));
    } catch {
      /* invalid image – shown as "signed" text only */
    }
  }

  for (const section of def.sections) {
    if (!conditionMet(section.showIf, data)) continue;
    const fields = section.fields.filter((f) => !f.pdfHidden && conditionMet(f.showIf, data) && f.type !== "photos");
    if (fields.length === 0) continue;
    // Keep short sections (e.g. declarations) together rather than splitting across pages
    const estimate = 22 + fields.reduce((h, f) => h + estimateHeight(f, data), 0);
    if (estimate < 420) L.ensure(estimate);
    sectionTitle(L, section.title);
    // Print the section's description (e.g. the ✓/✗ legend) above check tables
    if (section.description && fields.some((f) => f.type === "check")) {
      const ls = L.wrap(section.description.replace(/✓/g, "Tick").replace(/✗/g, "Cross"), 7.5, CONTENT_W - 8);
      L.lines(ls, M + 4, L.y, 7.5, { color: C.muted });
      L.y -= ls.length * lineH(7.5) + 4;
    }
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (f.type === "check") {
        const run: CheckField[] = [];
        while (i < fields.length && fields[i].type === "check") run.push(fields[i++] as CheckField);
        i--;
        drawCheckTable(L, run, data);
        continue;
      }
      drawField(L, f, data, sigImages);
    }
    L.y -= 6;
  }

  await drawPhotos(L, doc, def, data, meta);

  if (def.pdfFooterNotes?.length) {
    L.ensure(60);
    sectionTitle(L, "Notes for the recipient");
    for (const para of def.pdfFooterNotes) {
      const ls = L.wrap(para, 8, CONTENT_W - 8);
      L.ensure(ls.length * lineH(8) + 6);
      L.lines(ls, M + 4, L.y, 8, { color: C.ink });
      L.y -= ls.length * lineH(8) + 6;
    }
  }

  // Footers + watermark on every page
  const total = L.pages.length;
  L.pages.forEach((p, i) => {
    const footerY = M - 6;
    p.drawLine({ start: { x: M, y: footerY + 14 }, end: { x: A4.w - M, y: footerY + 14 }, thickness: 0.6, color: C.line });
    const left = `${meta.company.name}${meta.company.certificationBody ? ` · ${meta.company.certificationBody} ${meta.company.certificationNo}` : ""}`;
    p.drawText(clean(left), { x: M, y: footerY, size: 7.5, font, color: C.muted });
    const right = `${numberText} · Page ${i + 1} of ${total}`;
    p.drawText(right, { x: A4.w - M - font.widthOfTextAtSize(right, 7.5), y: footerY, size: 7.5, font, color: C.muted });
    if (meta.status !== "ISSUED") {
      const mark = meta.status === "VOID" ? "VOID" : "DRAFT";
      p.drawText(mark, {
        x: 120,
        y: 260,
        size: 120,
        font: bold,
        color: C.brand,
        opacity: 0.12,
        rotate: degrees(35),
      });
    }
  });

  return doc.save();
}

function drawFirstHeader(L: Layout, def: FormDefinition, meta: PdfMeta, numberText: string) {
  const { company } = meta;
  // Brand bar
  L.rect(0, A4.h - 6, A4.w, 6, C.brand);
  let y = A4.h - M;
  L.text(company.name.toUpperCase(), M, y - 14, 15, { font: L.bold, color: C.navy });
  let ly = y - 26;
  if (company.tagline) {
    L.text(company.tagline, M, ly, 8, { color: C.muted });
    ly -= 13;
  }
  const lines = [
    company.addressLines.replace(/\n/g, ", "),
    [company.phone && `Tel: ${company.phone}`, company.mobile && `WhatsApp: ${company.mobile}`].filter(Boolean).join("  |  "),
    [company.email && `Email: ${company.email}`, company.website && `Web: ${company.website}`].filter(Boolean).join("  |  "),
    company.companyRegNo ? `Company Registration No.: ${company.companyRegNo}` : "",
    company.certificationBody ? `${company.certificationBody}${company.certificationNo ? ` – ${company.certificationNo}` : ""}` : "",
  ].filter(Boolean);
  for (const ln of lines) {
    for (const w of L.wrap(ln, 7.5, 320)) {
      L.text(w, M, ly, 7.5, { color: C.ink });
      ly -= 10;
    }
  }

  // Certificate number box (top right)
  const boxW = 190;
  const bx = A4.w - M - boxW;
  L.rect(bx, y - 52, boxW, 52, C.band, C.line);
  L.text("CERTIFICATE NO.", bx + 10, y - 14, 7, { font: L.bold, color: C.muted });
  L.text(numberText, bx + 10, y - 29, 12, { font: L.bold, color: meta.number ? C.ink : C.brand });
  const issued = meta.issuedAt ? `Issued ${formatDate(meta.issuedAt.toISOString())}` : "Not issued";
  L.text(issued, bx + 10, y - 44, 8, { color: C.muted });

  y = Math.min(y - 70, ly - 8);
  // Title
  const titleLines = L.wrap(def.title.toUpperCase(), 12.5, CONTENT_W);
  L.lines(titleLines, M, y, 12.5, { font: L.bold, color: C.navy });
  y -= titleLines.length * lineH(12.5) + 2;
  if (def.subtitle) {
    L.text(def.subtitle, M, y - 9, 8.5, { color: C.ink });
    y -= 12;
  }
  L.text(`Based on the recommendations of ${def.standard}`, M, y - 9, 8, { color: C.muted });
  y -= 20;

  // Customer / premises blocks
  const colW = (CONTENT_W - 12) / 2;
  const block = (x: number, label: string, name: string, addr: string, pc: string) => {
    const body = L.wrap([addr.replace(/\n/g, ", "), pc].filter(Boolean).join(", "), 8.5, colW - 16);
    const h = 30 + body.length * lineH(8.5);
    L.rect(x, y - h, colW, h, C.white, C.line);
    L.text(label, x + 8, y - 12, 7, { font: L.bold, color: C.muted });
    L.text(L.wrap(name, 10, colW - 16, L.bold)[0] ?? "", x + 8, y - 25, 10, { font: L.bold });
    L.lines(body, x + 8, y - 28, 8.5);
    return h;
  };
  const h1 = block(M, "CLIENT", meta.customer.name, meta.customer.addressLines, meta.customer.postcode);
  const h2 = block(M + colW + 12, "PREMISES", meta.site.name, meta.site.addressLines, meta.site.postcode);
  L.y = y - Math.max(h1, h2) - 12;
}

function drawRunningHeader(L: Layout, def: FormDefinition, numberText: string) {
  L.rect(0, A4.h - 6, A4.w, 6, C.brand);
  const y = A4.h - M + 6;
  L.text(def.shortTitle, M, y - 10, 9, { font: L.bold });
  L.text(numberText, A4.w - M - L.bold.widthOfTextAtSize(numberText, 9), y - 10, 9, { font: L.bold });
  L.hline(y - 16);
  L.y = y - 26;
}

function estimateHeight(f: Field, data: FormData): number {
  if (f.type === "signature") return 58;
  if (f.type === "table") return 40 + ((data[f.name] as unknown[]) ?? []).length * 22;
  if (f.type === "note") return 14 + Math.ceil(f.text.length / 110) * 11;
  if (f.type === "check") return (data[f.name] as CheckValue | undefined)?.note ? 30 : 18;
  if (f.type === "checklist") return 18 + Math.ceil(f.options.length / 2) * 14;
  return 19;
}

function sectionTitle(L: Layout, title: string) {
  L.ensure(48);
  L.rect(M, L.y - 18, CONTENT_W, 18, C.navy);
  L.text(title.toUpperCase(), M + 8, L.y - 12.5, 8.5, { font: L.bold, color: C.white });
  L.y -= 22;
}

const LABEL_W = CONTENT_W * 0.52;
const VALUE_X = M + LABEL_W + 10;
const VALUE_W = CONTENT_W - LABEL_W - 14;

function drawRow(L: Layout, label: string, value: string, opts: { color?: RGB; bold?: boolean } = {}) {
  const size = 8.5;
  const labelLines = L.wrap(label, size, LABEL_W - 8);
  const valueLines = L.wrap(value || "–", size, VALUE_W, opts.bold ? L.bold : L.font);
  const h = Math.max(labelLines.length, valueLines.length) * lineH(size) + 6;
  L.ensure(h);
  L.lines(labelLines, M + 4, L.y - 2, size, { color: C.muted });
  L.lines(valueLines, VALUE_X, L.y - 2, size, {
    font: opts.bold ? L.bold : L.font,
    color: value ? (opts.color ?? C.ink) : C.muted,
  });
  L.y -= h;
  L.hline(L.y + 2);
}

function drawField(L: Layout, field: Field, data: FormData, sigs: Map<string, PDFImage>) {
  const value = data[field.name];
  switch (field.type) {
    case "note": {
      const lines = L.wrap(field.text, 8.5, CONTENT_W - 8);
      L.ensure(lines.length * lineH(8.5) + 8);
      L.lines(lines, M + 4, L.y - 2, 8.5);
      L.y -= lines.length * lineH(8.5) + 8;
      return;
    }
    case "check": {
      const v = (value ?? {}) as CheckValue;
      const txt = formatValue(field, v);
      const color = v.result === "PASS" ? C.good : v.result === "FAIL" ? C.bad : C.ink;
      drawRow(L, field.label, txt, { color, bold: v.result === "FAIL" || v.result === "PASS" });
      if (v.note) drawRow(L, "    Note", v.note);
      return;
    }
    case "signature": {
      const sig = value as SignatureValue | undefined;
      const img = sigs.get(field.name);
      const h = 56;
      L.ensure(h + 8);
      L.text(field.label, M + 4, L.y - 10, 8.5, { color: C.muted });
      if (img) {
        const scale = Math.min(180 / img.width, (h - 6) / img.height);
        L.page.drawImage(img, { x: VALUE_X, y: L.y - h + 2, width: img.width * scale, height: img.height * scale });
        if (sig?.signedAt) {
          L.text(`Signed ${formatDate(sig.signedAt)}`, M + 4, L.y - 24, 7.5, { color: C.muted });
        }
      } else {
        L.text("Not signed", VALUE_X, L.y - 10, 8.5, { color: C.muted });
      }
      L.y -= h;
      L.hline(L.y + 2);
      return;
    }
    case "table":
      drawTable(L, field, (value as Record<string, unknown>[]) ?? []);
      return;
    case "checklist":
      drawChecklist(L, field, Array.isArray(value) ? (value as string[]) : []);
      return;
    case "radio":
    case "select": {
      const tone = outcomeTone(value as string);
      const color = tone === "good" ? C.good : tone === "warn" ? C.warn : tone === "bad" ? C.bad : undefined;
      drawRow(L, field.label, formatValue(field, value), { color, bold: tone !== "neutral" });
      return;
    }
    default: {
      // Optional fields whose placeholder is "N/A" print N/A when left blank (as on paper certificates)
      const text = formatValue(field, value) || ("placeholder" in field && field.placeholder === "N/A" ? "N/A" : "");
      drawRow(L, field.label, text);
    }
  }
}

function drawTable(L: Layout, field: TableField, rows: Record<string, unknown>[]) {
  const size = 8;
  L.ensure(40);
  L.text(field.label, M + 4, L.y - 10, 8.5, { font: L.bold });
  L.y -= 16;
  if (rows.length === 0) {
    L.text("None recorded", M + 4, L.y - 9, 8.5, { color: C.muted });
    L.y -= 16;
    return;
  }
  // Column widths: weight text columns more than numbers/selects
  const weights = field.columns.map((c) => (c.type === "number" ? 0.8 : c.type === "text" ? 2 : 1.3));
  const totalW = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => (w / totalW) * CONTENT_W);
  const xs = widths.map((_, i) => M + widths.slice(0, i).reduce((a, b) => a + b, 0));

  const header = () => {
    const hl = field.columns.map((c, i) => L.wrap(c.label, size, widths[i] - 8, L.bold));
    const h = Math.max(...hl.map((l) => l.length)) * lineH(size) + 6;
    L.rect(M, L.y - h, CONTENT_W, h, C.band);
    hl.forEach((lines, i) => L.lines(lines, xs[i] + 4, L.y - 2, size, { font: L.bold }));
    L.y -= h;
  };
  header();
  for (const row of rows) {
    const cells = field.columns.map((c, i) => L.wrap(formatValue(c, row[c.name]) || "–", size, widths[i] - 8));
    const h = Math.max(...cells.map((l) => l.length)) * lineH(size) + 6;
    if (L.ensure(h)) header();
    cells.forEach((lines, i) => {
      const v = row[field.columns[i].name];
      const tone = outcomeTone(v as string);
      const color =
        v === "FAIL" || v === "CRITICAL" ? C.bad : v === "PASS" ? C.good : tone === "neutral" ? C.ink : undefined;
      L.lines(lines, xs[i] + 4, L.y - 2, size, { color });
    });
    L.y -= h;
    L.hline(L.y);
  }
  L.y -= 6;
}

async function drawPhotos(L: Layout, doc: PDFDocument, def: FormDefinition, data: FormData, meta: PdfMeta) {
  const photoFields = def.sections
    .filter((s) => conditionMet(s.showIf, data))
    .flatMap((s) => s.fields)
    .filter((f) => f.type === "photos" && conditionMet(f.showIf, data));
  const items: { img: PDFImage; caption: string }[] = [];
  for (const f of photoFields) {
    for (const p of (data[f.name] as { id: string; caption?: string }[]) ?? []) {
      const file = meta.photos.find((x) => x.id === p.id);
      if (!file) continue;
      try {
        const img = file.mimeType === "image/png" ? await doc.embedPng(file.bytes) : await doc.embedJpg(file.bytes);
        items.push({ img, caption: p.caption ?? "" });
      } catch {
        /* skip unreadable image */
      }
    }
  }
  if (items.length === 0) return;
  sectionTitle(L, "Photographs");
  const gap = 12;
  const cellW = (CONTENT_W - gap) / 2;
  const cellH = 190;
  for (let i = 0; i < items.length; i += 2) {
    L.ensure(cellH + 24);
    for (let j = 0; j < 2 && i + j < items.length; j++) {
      const { img, caption } = items[i + j];
      const x = M + j * (cellW + gap);
      const scale = Math.min(cellW / img.width, cellH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      L.rect(x, L.y - cellH, cellW, cellH, C.band);
      L.page.drawImage(img, { x: x + (cellW - w) / 2, y: L.y - cellH + (cellH - h) / 2, width: w, height: h });
      L.text(L.wrap(`${i + j + 1}. ${caption}`, 8, cellW)[0] ?? "", x, L.y - cellH - 11, 8, { color: C.muted });
    }
    L.y -= cellH + 22;
  }
}

// ---- Tick marks, checklists and check tables ----------------------------------
function drawTick(L: Layout, x: number, y: number, size: number, color: RGB) {
  L.page.drawLine({ start: { x, y: y + size * 0.45 }, end: { x: x + size * 0.38, y: y + size * 0.08 }, thickness: 1.4, color });
  L.page.drawLine({ start: { x: x + size * 0.38, y: y + size * 0.08 }, end: { x: x + size, y: y + size * 0.9 }, thickness: 1.4, color });
}
function drawCross(L: Layout, x: number, y: number, size: number, color: RGB) {
  L.page.drawLine({ start: { x, y }, end: { x: x + size, y: y + size }, thickness: 1.4, color });
  L.page.drawLine({ start: { x, y: y + size }, end: { x: x + size, y }, thickness: 1.4, color });
}

function drawChecklist(L: Layout, field: ChecklistField, picked: string[]) {
  const size = 8.5;
  L.ensure(30);
  L.text(field.label, M + 4, L.y - 10, size, { font: L.bold });
  L.y -= 16;
  const colW = (CONTENT_W - 8) / 2;
  for (let i = 0; i < field.options.length; i += 2) {
    const pair = field.options.slice(i, i + 2);
    const wrapped = pair.map((o) => L.wrap(o.label, size, colW - 22));
    const h = Math.max(...wrapped.map((w) => w.length)) * lineH(size) + 4;
    L.ensure(h);
    pair.forEach((o, j) => {
      const x = M + 4 + j * colW;
      const by = L.y - 10;
      L.page.drawRectangle({ x, y: by, width: 9, height: 9, borderColor: C.ink, borderWidth: 0.7 });
      if (picked.includes(o.value)) drawTick(L, x + 1.5, by + 1.5, 6, C.good);
      L.lines(wrapped[j], x + 15, L.y - 1.5, size);
    });
    L.y -= h;
  }
  L.y -= 4;
  L.hline(L.y + 2);
}

function drawCheckTable(L: Layout, checks: CheckField[], data: FormData) {
  const size = 8;
  const numbered = checks.some((c) => c.number);
  const wNo = numbered ? 26 : 0;
  const wRes = 46;
  const wCom = 140;
  const wDesc = CONTENT_W - wNo - wRes - wCom;
  const xNo = M;
  const xDesc = M + wNo;
  const xRes = xDesc + wDesc;
  const xCom = xRes + wRes;

  const header = () => {
    const h = 15;
    L.rect(M, L.y - h, CONTENT_W, h, C.band);
    if (numbered) L.text("Item", xNo + 4, L.y - 10.5, 7.5, { font: L.bold });
    L.text("Description", xDesc + 4, L.y - 10.5, 7.5, { font: L.bold });
    L.text("Outcome", xRes + 4, L.y - 10.5, 7.5, { font: L.bold });
    L.text("Comments", xCom + 4, L.y - 10.5, 7.5, { font: L.bold });
    L.y -= h;
  };
  L.ensure(40);
  header();
  for (const c of checks) {
    const v = (data[c.name] ?? { result: "" }) as CheckValue;
    const desc = L.wrap(c.label, size, wDesc - 8);
    const com = L.wrap(v.note || (v.result ? "" : "–"), size, wCom - 8);
    const h = Math.max(desc.length, com.length, 1) * lineH(size) + 6;
    if (L.ensure(h)) header();
    if (c.number) L.text(c.number, xNo + 4, L.y - 2 - size, size, { font: L.bold });
    L.lines(desc, xDesc + 4, L.y - 2, size);
    const cy = L.y - h / 2 - 4;
    if (v.result === "PASS") {
      if (c.style === "tick-cross") drawTick(L, xRes + 16, cy, 8, C.good);
      else L.text("Pass", xRes + 4, L.y - 2 - size, size, { font: L.bold, color: C.good });
    } else if (v.result === "FAIL") {
      if (c.style === "tick-cross") drawCross(L, xRes + 16, cy, 7.5, C.bad);
      else L.text("Fail", xRes + 4, L.y - 2 - size, size, { font: L.bold, color: C.bad });
    } else if (v.result === "NA" || v.result === "LIM") {
      L.text(v.result === "NA" ? "N/A" : "LIM", xRes + 4, L.y - 2 - size, size, { font: L.bold, color: v.result === "LIM" ? C.warn : C.ink });
    }
    L.lines(com, xCom + 4, L.y - 2, size, { color: v.note ? C.ink : C.muted });
    L.y -= h;
    L.hline(L.y);
  }
  // column rules
  L.y -= 6;
}
