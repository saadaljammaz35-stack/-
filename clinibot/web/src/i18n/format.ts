import type { Lang } from "./types";

/** Latin digits in both languages (Saudi business convention for prices/phones). */
export const NUMBER_LOCALE: Record<Lang, string> = {
  ar: "ar-SA-u-nu-latn",
  en: "en-US",
};

/** Gregorian calendar + Latin digits (ar-SA would otherwise default to Hijri). */
export const DATE_LOCALE: Record<Lang, string> = {
  ar: "ar-SA-u-ca-gregory-nu-latn",
  en: "en-GB-u-ca-gregory-nu-latn",
};

/** Clinics are in Saudi Arabia; show times in Riyadh time unless told otherwise. */
export const DEFAULT_TIME_ZONE = "Asia/Riyadh";

export function formatNumber(
  lang: Lang,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(NUMBER_LOCALE[lang], options).format(value);
}

export type DateInput = Date | string | number;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
};

/**
 * Formats a date (Gregorian, Latin digits). Default: "12 أكتوبر 2026" / "12 Oct 2026".
 * Pass Intl options for time, e.g. { dateStyle: "medium", timeStyle: "short" }.
 * Date-only strings ("2026-10-12") are treated as calendar dates, never shifted
 * by time zone. Invalid input returns an empty string.
 */
export function formatDate(
  lang: Lang,
  value: DateInput,
  options?: Intl.DateTimeFormatOptions,
): string {
  let date: Date;
  let timeZone = options?.timeZone ?? DEFAULT_TIME_ZONE;
  const dateOnly = typeof value === "string" ? DATE_ONLY.exec(value) : null;
  if (dateOnly) {
    date = new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])));
    timeZone = "UTC";
  } else {
    date = value instanceof Date ? value : new Date(value);
  }
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(DATE_LOCALE[lang], {
    ...(options ?? DEFAULT_DATE_OPTIONS),
    timeZone,
  }).format(date);
}

/**
 * Saudi riyal amounts: "299 ر.س" (ar) / "SAR 299" (en). Whole amounts have no
 * decimals; fractional amounts always show two ("299.50 ر.س").
 */
export function formatSar(lang: Lang, amount: number): string {
  const whole = Number.isInteger(amount);
  const number = formatNumber(lang, amount, {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return lang === "ar" ? `${number} ر.س` : `SAR ${number}`;
}
