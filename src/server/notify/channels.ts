import "server-only";
/**
 * Delivery channels. Each channel is optional and switches on when its settings are present
 * in the environment. Add a new channel (e.g. Telegram) by implementing Channel and adding it
 * to CHANNELS.
 */
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

export type ChannelName = "email" | "sms" | "whatsapp";

export interface OutgoingMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Uint8Array; contentType: string }[];
}

export interface SendResult {
  status: "SENT" | "LOGGED";
  providerId?: string;
}

export interface Channel {
  name: ChannelName;
  enabled(): boolean;
  send(msg: OutgoingMessage): Promise<SendResult>;
}

let transporter: Transporter | null = null;
const email: Channel = {
  name: "email",
  enabled: () => true, // falls back to logging when SMTP isn't configured
  async send(msg) {
    if (!env.smtp.host) {
      console.info(`[email:dev] To: ${msg.to} | ${msg.subject}\n${msg.text}`);
      return { status: "LOGGED" };
    }
    transporter ??= nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
    const info = await transporter.sendMail({
      from: env.smtp.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      attachments: msg.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content),
        contentType: a.contentType,
      })),
    });
    return { status: "SENT", providerId: info.messageId };
  },
};

async function twilioSend(from: string, to: string, body: string): Promise<SendResult> {
  const { sid, token } = env.twilio;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }),
  });
  const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!res.ok) throw new Error(`Twilio error ${res.status}: ${json.message ?? "unknown"}`);
  return { status: "SENT", providerId: json.sid };
}

const sms: Channel = {
  name: "sms",
  enabled: () => !!(env.twilio.sid && env.twilio.token && env.twilio.smsFrom),
  send: (msg) => twilioSend(env.twilio.smsFrom, msg.to, msg.text),
};

const whatsapp: Channel = {
  name: "whatsapp",
  enabled: () => !!(env.twilio.sid && env.twilio.token && env.twilio.whatsappFrom),
  send: (msg) => twilioSend(env.twilio.whatsappFrom, `whatsapp:${msg.to}`, msg.text),
};

export const CHANNELS: Record<ChannelName, Channel> = { email, sms, whatsapp };
