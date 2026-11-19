/** Riyadh is UTC+3 all year (no DST). */
const OFFSET_MS = 3 * 3600_000;

export function riyadhStartOfDay(d = new Date()): Date {
  const local = new Date(d.getTime() + OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - OFFSET_MS);
}

export function daysAgo(n: number, from = new Date()): Date {
  return new Date(riyadhStartOfDay(from).getTime() - n * 86400_000);
}

export function fmtDateTime(iso: string, locale: 'ar' | 'en'): string {
  return new Date(iso).toLocaleString(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', {
    timeZone: 'Asia/Riyadh', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function fmtTime(iso: string, locale: 'ar' | 'en'): string {
  return new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' });
}
