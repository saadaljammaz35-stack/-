// Hijri calendar on the Umm al-Qura tables (as used officially in Saudi Arabia), with an
// optional user adjustment of ± days for local moon sighting.
import { toGregorian as ummAlQuraToGregorian, toHijri as ummAlQuraToHijri } from 'hijri-converter';

export type HijriDate = { year: number; month: number; day: number };
export type CivilDate = { year: number; month: number; day: number };

export const HIJRI_MONTHS = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
];

export const GREGORIAN_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
/** One-letter weekday abbreviations used in Arabic calendars (Sunday first). */
export const WEEKDAYS_SHORT = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

const DAY_MS = 86_400_000;

function addDays(d: CivilDate, days: number): CivilDate {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day) + days * DAY_MS);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/** Converts a civil (Gregorian) date to Hijri; `offset` shifts the result by whole days. */
export function toHijri(date: CivilDate, offset = 0): HijriDate {
  const d = offset ? addDays(date, offset) : date;
  const h = ummAlQuraToHijri(d.year, d.month, d.day);
  return { year: h.hy, month: h.hm, day: h.hd };
}

/** Converts a Hijri date back to the civil date (inverse of `toHijri` with the same offset). */
export function toGregorian(date: HijriDate, offset = 0): CivilDate {
  const g = ummAlQuraToGregorian(date.year, date.month, date.day);
  const civil = { year: g.gy, month: g.gm, day: g.gd };
  return offset ? addDays(civil, -offset) : civil;
}

export function civilWeekday(date: CivilDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

/** Days from `a` to `b` (positive when b is later). */
export function daysBetween(a: CivilDate, b: CivilDate): number {
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS,
  );
}

export function addCivilDays(d: CivilDate, days: number): CivilDate {
  return addDays(d, days);
}

export function civilKey(d: CivilDate): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

export function parseCivilKey(key: string): CivilDate {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

export function formatHijri(h: HijriDate): string {
  return `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year}هـ`;
}

export function formatCivil(d: CivilDate): string {
  return `${d.day} ${GREGORIAN_MONTHS[d.month - 1]} ${d.year}م`;
}
