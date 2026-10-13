import type { Lang } from "@/i18n";
import { formatDate, NUMBER_LOCALE } from "@/i18n/format";

/**
 * Time helpers shared by the overview, conversations and appointments pages.
 *
 * Clinics work in Asia/Riyadh: UTC+3 all year (Saudi Arabia has no daylight
 * saving time), so local ↔ UTC is a fixed three-hour shift. That is what the
 * database uses too (dashboard_metrics groups days "at time zone 'Asia/Riyadh'").
 */
export const RIYADH_OFFSET_MINUTES = 180;
const OFFSET_MS = RIYADH_OFFSET_MINUTES * 60_000;

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_KEY = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** The calendar date in Riyadh ("2026-10-12") of an instant. */
export function riyadhDateKey(value: Date | string | number): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Today's date in Riyadh. */
export function riyadhToday(now: Date = new Date()): string {
  return riyadhDateKey(now);
}

/** Adds whole days to a "YYYY-MM-DD" key (negative to go back). */
export function addDays(dateKey: string, days: number): string {
  const match = DATE_KEY.exec(dateKey);
  if (!match) return dateKey;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
  return new Date(time).toISOString().slice(0, 10);
}

export function isDateKey(value: string): boolean {
  const match = DATE_KEY.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

export function isTimeKey(value: string): boolean {
  return TIME_KEY.test(value);
}

/**
 * A wall-clock date and time typed in Riyadh ("2026-10-15", "16:30") as an ISO
 * UTC timestamp ("2026-10-15T13:30:00.000Z"). Null for invalid input.
 */
export function riyadhLocalToUtcIso(date: string, time: string): string | null {
  const d = DATE_KEY.exec(date);
  const t = TIME_KEY.exec(time);
  if (!d || !t || !isDateKey(date)) return null;
  const utc =
    Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2])) - OFFSET_MS;
  return new Date(utc).toISOString();
}

/** The Riyadh wall-clock date and time ("HH:MM") of a UTC timestamp. */
export function utcToRiyadhLocal(value: string | Date): { date: string; time: string } | null {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return null;
  const shifted = new Date(date.getTime() + OFFSET_MS).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

/** True when the instant is earlier than now. */
export function isPast(value: string | Date, now: Date = new Date()): boolean {
  const time = toDate(value).getTime();
  return Number.isFinite(time) && time < now.getTime();
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "قبل 5 دقائق" / "5 minutes ago", "أمس" / "yesterday"; older than a week
 * falls back to the date ("3 أكتوبر"). Latin digits in both languages.
 */
export function formatRelativeTime(
  lang: Lang,
  value: Date | string | number,
  now: Date = new Date(),
): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  // A timestamp slightly ahead of this clock (server vs. device skew) reads as "now".
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  const rtf = new Intl.RelativeTimeFormat(NUMBER_LOCALE[lang], { numeric: "auto" });
  if (seconds < MINUTE) return rtf.format(0, "second");
  if (seconds < HOUR) return rtf.format(-Math.floor(seconds / MINUTE), "minute");
  if (seconds < DAY) return rtf.format(-Math.floor(seconds / HOUR), "hour");
  if (seconds < 7 * DAY) return rtf.format(-Math.floor(seconds / DAY), "day");
  const sameYear = riyadhDateKey(date).slice(0, 4) === riyadhDateKey(now).slice(0, 4);
  return formatDate(lang, date, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Date and time in Riyadh, e.g. "15 أكتوبر 2026، 4:30 م". */
export function formatDateTime(lang: Lang, value: Date | string): string {
  return formatDate(lang, value, { dateStyle: "medium", timeStyle: "short" });
}
