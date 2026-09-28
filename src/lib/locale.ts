const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const pesoWhole = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

/** Shared Philippine Peso formatter used everywhere in the app. */
export function formatMoney(n: number | string | null | undefined, opts?: { whole?: boolean }): string {
  const v = Number(n ?? 0);
  return (opts?.whole ? pesoWhole : peso).format(Number.isFinite(v) ? v : 0);
}

export const TIMEZONE = "Asia/Manila";

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleString("en-PH", { timeZone: TIMEZONE, dateStyle: "medium", timeStyle: "short" });
}

export function formatDate(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-PH", { timeZone: TIMEZONE, ...opts });
}

/** Normalise a Philippine mobile number to +639XXXXXXXXX, or null if invalid. */
export function normalizePhMobile(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let m = digits.match(/^(?:\+?63|0)?(9\d{9})$/);
  if (!m) return null;
  return `+63${m[1]}`;
}

export function formatPhMobile(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = e164.match(/^\+63(9\d{2})(\d{3})(\d{4})$/);
  return m ? `+63 ${m[1]} ${m[2]} ${m[3]}` : e164;
}

export const PHONE_PLACEHOLDER = "0917 123 4567";
