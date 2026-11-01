/* Arabic formatting with Gregorian calendar and Latin digits for clarity. */
const LOCALE = "ar-SA-u-ca-gregory-nu-latn";

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12));
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
    ...opts,
  }).format(parseISODate(iso));
}

export function formatShortDate(iso: string): string {
  return formatDate(iso, { weekday: "short", year: undefined, month: "short" });
}

export function formatDateTime(isoTimestamp: string, timeZone = "Asia/Riyadh"): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(isoTimestamp));
}

/** "14:30" or "14:30:00" → "2:30 م" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "ص" : "م";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatPrice(price: number | null | undefined, currency = "ر.س"): string | null {
  if (price === null || price === undefined) return null;
  const n = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }).format(price);
  return `${n} ${currency}`.trim();
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} دقيقة`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 1 ? "ساعة" : h === 2 ? "ساعتان" : `${h} ساعات`;
  return m ? `${hours} و${m} دقيقة` : hours;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(LOCALE).format(n);
}

/** YYYY-MM-DD for "today" in the studio's timezone */
export function todayInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA formats as YYYY-MM-DD
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(iso: string): number {
  return parseISODate(iso).getUTCDay();
}

export function trimTime(t: string): string {
  return t.slice(0, 5);
}

/** Digits only, keeping a leading + — used for tel: and wa.me links */
export function phoneHref(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export function whatsappHref(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${q}`;
}
