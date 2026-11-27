import type { Locale } from './i18n/config';

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/** Parses "1:02:05", "62:05", "125", "1h2m5s" into seconds. Returns null for anything else. */
export function parseTimestamp(input: string | null | undefined): number | null {
  if (!input) return null;
  const value = input.trim();
  if (/^\d+(\.\d+)?$/.test(value)) return Math.floor(Number(value));
  const hms = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(value);
  if (hms && value !== '' && (hms[1] || hms[2] || hms[3])) {
    return Number(hms[1] ?? 0) * 3600 + Number(hms[2] ?? 0) * 60 + Number(hms[3] ?? 0);
  }
  const parts = value.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}(\.\d+)?$/.test(p) && !/^\d+$/.test(p))) {
    return null;
  }
  const nums = parts.map((p) => Math.floor(Number(p)));
  if (nums.slice(1).some((n) => n > 59)) return null;
  return nums.reduce((acc, n) => acc * 60 + n, 0);
}

/** Arabic count of minutes with correct grammatical number: دقيقة / دقيقتان / 3 دقائق / 11 دقيقة. */
export function arabicMinutes(n: number): string {
  if (n === 1) return 'دقيقة';
  if (n === 2) return 'دقيقتان';
  const mod = n % 100;
  if (mod >= 3 && mod <= 10) return `${n} دقائق`;
  return `${n} دقيقة`;
}

export function formatMinutes(n: number, locale: Locale): string {
  return locale === 'ar' ? arabicMinutes(n) : `${n} min`;
}

export function formatDuration(totalSeconds: number | null | undefined, locale: Locale): string | null {
  if (!totalSeconds || totalSeconds <= 0) return null;
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  if (minutes < 60) return formatMinutes(minutes, locale);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (locale === 'ar') return m ? `${h} س ${m} د` : `${h} ساعة`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const dateFormatters: Record<Locale, Intl.DateTimeFormat> = {
  ar: new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }),
  en: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }),
};

export function formatDate(value: string | Date | null | undefined, locale: Locale): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return dateFormatters[locale].format(date);
}

export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Lowercase ASCII slug. Arabic titles need an explicit slug, so this returns '' when nothing usable remains. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
