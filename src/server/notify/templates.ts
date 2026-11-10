/** Message wording. Edit here to change what customers receive. */
import { formatUK, formatUKDateTime } from "@/lib/dates";
import type { ReminderKind } from "@/server/schedule-rules";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailLayout(company: string, heading: string, paragraphs: string[], cta?: { label: string; url: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.5">${esc(p)}</p>`).join("");
  const button = cta
    ? `<p style="margin:22px 0"><a href="${esc(cta.url)}" style="background:#c92a2a;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#151920">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e3e6ea">
<tr><td style="background:#c92a2a;height:6px"></td></tr>
<tr><td style="padding:24px 28px">
<div style="font-size:13px;color:#646d7c;font-weight:600;margin-bottom:10px">${esc(company)}</div>
<h1 style="font-size:20px;margin:0 0 16px">${esc(heading)}</h1>${body}${button}
</td></tr></table>
<div style="font-size:11px;color:#8b94a3;margin-top:12px">${esc(company)}</div>
</td></tr></table></body></html>`;
}

interface ReminderCtx {
  /** e.g. "fire alarm service" or "emergency lighting inspection" */
  service: string;
  company: string;
  companyPhone: string;
  customerName: string;
  siteName: string;
  siteAddress: string;
  dueDate: string;
  bookedFor: Date | null;
  portalUrl: string;
}

export function reminderMessage(kind: ReminderKind, c: ReminderCtx) {
  const due = formatUK(c.dueDate);
  const call = c.companyPhone ? ` Please call ${c.companyPhone} to arrange a convenient date.` : "";
  const svc = c.service;
  const Svc = svc.charAt(0).toUpperCase() + svc.slice(1);
  const lines: Record<ReminderKind, { subject: string; heading: string; body: string; sms: string }> = {
    DUE_30: {
      subject: `${Svc} due ${due} – ${c.siteName}`,
      heading: `Your ${svc} is due soon`,
      body: `The ${svc} at ${c.siteName} is due on ${due}.${call}`,
      sms: `${c.company}: the ${svc} at ${c.siteName} is due on ${due}.${call}`,
    },
    DUE_7: {
      subject: `Reminder: ${svc} due ${due} – ${c.siteName}`,
      heading: `${Svc} due in the next 7 days`,
      body: `The ${svc} at ${c.siteName} is due on ${due}. Regular servicing keeps your system reliable and helps you meet your fire safety duties.${call}`,
      sms: `${c.company}: reminder – ${svc} at ${c.siteName} is due ${due}.${call}`,
    },
    OVERDUE: {
      subject: `Overdue: ${svc} – ${c.siteName}`,
      heading: `Your ${svc} is overdue`,
      body: `The ${svc} at ${c.siteName} was due on ${due} and has not yet been carried out.${call}`,
      sms: `${c.company}: the ${svc} at ${c.siteName} is overdue (due ${due}).${call}`,
    },
    OVERDUE_30: {
      subject: `Action needed: ${svc} overdue – ${c.siteName}`,
      heading: `${Svc} more than 30 days overdue`,
      body: `The ${svc} at ${c.siteName} was due on ${due}. Please contact us to arrange the visit as soon as possible.${call}`,
      sms: `${c.company}: the ${svc} at ${c.siteName} is now over 30 days overdue.${call}`,
    },
    BOOKED_TOMORROW: {
      subject: `Visit confirmed: ${svc} – ${c.siteName}`,
      heading: "Your visit is coming up",
      body: `Our engineer is booked to attend ${c.siteName} for your ${svc} on ${formatUKDateTime(c.bookedFor)}. Please make sure access is available and let occupants know that systems will be tested.`,
      sms: `${c.company}: our engineer will attend ${c.siteName} for your ${svc} on ${formatUKDateTime(c.bookedFor)}.`,
    },
  };
  const l = lines[kind];
  const paragraphs = [`Dear ${c.customerName},`, l.body, `Site address: ${c.siteAddress}`];
  return {
    subject: l.subject,
    text: `${paragraphs.join("\n\n")}\n\nView your certificates: ${c.portalUrl}\n\n${c.company}`,
    html: emailLayout(c.company, l.heading, paragraphs, { label: "View your certificates", url: c.portalUrl }),
    sms: l.sms,
  };
}

export function visitBookedMessage(c: ReminderCtx) {
  const when = formatUKDateTime(c.bookedFor);
  const paragraphs = [
    `Dear ${c.customerName},`,
    `We have booked your ${c.service} at ${c.siteName} for ${when}.`,
    `Site address: ${c.siteAddress}`,
    c.companyPhone ? `If this time isn't suitable, please call ${c.companyPhone}.` : "",
  ].filter(Boolean);
  return {
    subject: `Visit booked: ${c.service} – ${c.siteName}, ${when}`,
    text: `${paragraphs.join("\n\n")}\n\n${c.company}`,
    html: emailLayout(c.company, "Visit booked", paragraphs),
    sms: `${c.company}: ${c.service} at ${c.siteName} booked for ${when}.`,
  };
}

export function certificateIssuedMessage(c: {
  company: string;
  customerName: string;
  siteName: string;
  certTitle: string;
  certNumber: string;
  outcome: string;
  nextDue: string | null;
  portalUrl: string;
}) {
  const paragraphs = [
    `Dear ${c.customerName},`,
    `Your ${c.certTitle} for ${c.siteName} has been issued (certificate ${c.certNumber}). A copy is attached and is always available in your customer portal.`,
    c.outcome ? `Result: ${c.outcome}.` : "",
    c.nextDue ? `Next service due: ${formatUK(c.nextDue)}.` : "",
  ].filter(Boolean);
  return {
    subject: `Certificate ${c.certNumber} – ${c.siteName}`,
    text: `${paragraphs.join("\n\n")}\n\nCustomer portal: ${c.portalUrl}\n\n${c.company}`,
    html: emailLayout(c.company, "Your certificate is ready", paragraphs, { label: "Open customer portal", url: c.portalUrl }),
  };
}

export function inviteMessage(c: { company: string; name: string; url: string; portal: boolean }) {
  const paragraphs = [
    `Hello ${c.name},`,
    c.portal
      ? `${c.company} has created a customer portal account for you. You can use it to download your fire safety certificates and see upcoming service visits at any time.`
      : `${c.company} has created an account for you on FireCert.`,
    "Use the button below to set your password. The link is valid for 7 days.",
  ];
  return {
    subject: `Set up your ${c.company} account`,
    text: `${paragraphs.join("\n\n")}\n\n${c.url}`,
    html: emailLayout(c.company, "Set up your account", paragraphs, { label: "Set password", url: c.url }),
  };
}

export function resetMessage(c: { company: string; name: string; url: string }) {
  const paragraphs = [
    `Hello ${c.name},`,
    "We received a request to reset your password. The link below is valid for 2 hours. If you didn't ask for this, you can ignore this email.",
  ];
  return {
    subject: "Reset your password",
    text: `${paragraphs.join("\n\n")}\n\n${c.url}`,
    html: emailLayout(c.company, "Reset your password", paragraphs, { label: "Reset password", url: c.url }),
  };
}

export function officeDigestMessage(company: string, rows: { site: string; customer: string; due: string; state: string; service: string }[], url: string) {
  const text = rows.map((r) => `• ${r.state}: ${r.site} (${r.customer}) – ${r.service} due ${formatUK(r.due)}`).join("\n");
  const html = emailLayout(
    company,
    `Service schedule: ${rows.length} site${rows.length === 1 ? "" : "s"} need attention`,
    rows.map((r) => `${r.state}: ${r.site} (${r.customer}) – ${r.service} due ${formatUK(r.due)}`),
    { label: "Open schedule", url },
  );
  return { subject: `Service schedule – ${rows.length} site(s) overdue or due soon`, text, html };
}
