export { clsx as cn } from "clsx";

/** Normalises a UK phone number to E.164 (+44...). Returns null if it doesn't look valid. */
export function toE164(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  if (/^00\d{8,15}$/.test(digits)) return `+${digits.slice(2)}`;
  if (/^0\d{9,10}$/.test(digits)) return `+44${digits.slice(1)}`;
  return null;
}

export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function oneLine(address: string, postcode?: string): string {
  return [address.split(/\n+/).map((l) => l.trim()).filter(Boolean).join(", "), postcode].filter(Boolean).join(", ");
}
