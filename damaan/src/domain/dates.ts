/** Date helpers. Everything compares at day granularity — a deadline is a day, not an instant. */

export function startOfDay(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = startOfDay(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Adds calendar months, clamping the day so the result stays inside the target
 * month: 31 January plus one month is 28 February, not 3 March.
 */
export function addMonths(date: Date, months: number): Date {
  const copy = startOfDay(date);
  const targetDay = copy.getDate();
  copy.setDate(1);
  copy.setMonth(copy.getMonth() + months);
  const lastDayOfTargetMonth = new Date(copy.getFullYear(), copy.getMonth() + 1, 0).getDate();
  copy.setDate(Math.min(targetDay, lastDayOfTargetMonth));
  return copy;
}

/** Whole days from `from` to `to`. Negative once `to` is in the past. */
export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 86_400_000;
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / msPerDay);
}

/** `yyyy-mm-dd`, the form every date is stored in. */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

/** `12 مارس 2026` — readable, unambiguous, Latin digits. */
export function formatLongDate(date: Date): string {
  return `${date.getDate()} ${arabicMonths[date.getMonth()]} ${date.getFullYear()}`;
}

/** `12/03/2026` — compact, for dense rows. */
export function formatShortDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

/**
 * Arabic counted nouns. Arabic marks one, two, a few (3–10) and many (11+)
 * differently, and getting it wrong is the first thing a native reader notices.
 */
export function arabicCount(
  count: number,
  forms: { one: string; two: string; few: string; many: string },
): string {
  const n = Math.abs(count);
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  if (n >= 3 && n <= 10) return `${n} ${forms.few}`;
  return `${n} ${forms.many}`;
}

/**
 * The dual form is written `يومين`, not `يومان`: it reads naturally both as a
 * remaining count ("باقي يومين") and after a preposition ("قبل يومين"), which are
 * the only two places this string appears.
 */
export function countDays(days: number): string {
  return arabicCount(days, { one: 'يوم واحد', two: 'يومين', few: 'أيام', many: 'يومًا' });
}

export function countMonths(months: number): string {
  return arabicCount(months, { one: 'شهر واحد', two: 'شهران', few: 'أشهر', many: 'شهرًا' });
}

/** Months expressed the way a person would say them: 24 months is "سنتان". */
export function humanDuration(months: number): string {
  if (months === 0) return 'بدون ضمان';
  if (months % 12 === 0) {
    const years = months / 12;
    return arabicCount(years, { one: 'سنة واحدة', two: 'سنتان', few: 'سنوات', many: 'سنة' });
  }
  return countMonths(months);
}
