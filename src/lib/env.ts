/** Typed access to environment variables. Fails fast with a clear message if a required one is missing. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  return v;
}

export const env = {
  get authSecret() {
    const s = required("AUTH_SECRET");
    if (s.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
    return s;
  },
  get appUrl() {
    // RENDER_EXTERNAL_URL is provided automatically on Render until you set APP_URL
    return (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000").replace(/\/$/, "");
  },
  get storageDir() {
    return process.env.STORAGE_DIR ?? "./storage";
  },
  get cronSecret() {
    return process.env.CRON_SECRET ?? "";
  },
  smtp: {
    get host() { return process.env.SMTP_HOST ?? ""; },
    get port() { return Number(process.env.SMTP_PORT ?? 587); },
    get user() { return process.env.SMTP_USER ?? ""; },
    get pass() { return process.env.SMTP_PASS ?? ""; },
    get from() { return process.env.SMTP_FROM ?? "FireCert <no-reply@example.com>"; },
  },
  get officeEmail() {
    return process.env.OFFICE_NOTIFY_EMAIL ?? "";
  },
  twilio: {
    get sid() { return process.env.TWILIO_ACCOUNT_SID ?? ""; },
    get token() { return process.env.TWILIO_AUTH_TOKEN ?? ""; },
    get smsFrom() { return process.env.TWILIO_SMS_FROM ?? ""; },
    get whatsappFrom() { return process.env.TWILIO_WHATSAPP_FROM ?? ""; },
  },
};
