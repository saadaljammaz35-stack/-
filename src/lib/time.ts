// Time-zone aware helpers. Prayer times are absolute instants; they are always shown in
// the selected city's own time zone, which may differ from the device's.
import { toArabicDigits } from './arabic';
import type { CivilDate } from './hijri';

export type DigitStyle = 'latin' | 'arabic';

export type ZonedParts = CivilDate & { hour: number; minute: number; second: number; weekday: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts: Record<string, string> = {};
  for (const p of formatterFor(timeZone).formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  };
}

export function civilDateIn(date: Date, timeZone: string): CivilDate {
  const p = zonedParts(date, timeZone);
  return { year: p.year, month: p.month, day: p.day };
}

/** Offset (minutes) of `timeZone` from UTC at the given instant. */
export function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** The instant at which the wall clock in `timeZone` shows the given date and time. */
export function instantAt(date: CivilDate, hour: number, minute: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(date.year, date.month - 1, date.day, hour, minute));
  const offset = zoneOffsetMinutes(guess, timeZone);
  const result = new Date(guess.getTime() - offset * 60000);
  // Re-check once around DST transitions.
  const offset2 = zoneOffsetMinutes(result, timeZone);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2 * 60000);
}

export function digits(value: string | number, style: DigitStyle): string {
  return style === 'arabic' ? toArabicDigits(value) : String(value);
}

/** «4:37 ص» style 12-hour time in the given zone. */
export function formatTime(date: Date, timeZone: string, style: DigitStyle = 'latin', use24h = false, lang: 'ar' | 'en' = 'ar'): string {
  const p = zonedParts(date, timeZone);
  const mm = String(p.minute).padStart(2, '0');
  if (use24h) return digits(`${String(p.hour).padStart(2, '0')}:${mm}`, style);
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  const suffix = lang === 'en' ? (p.hour < 12 ? 'AM' : 'PM') : p.hour < 12 ? 'ص' : 'م';
  return `${digits(`${h12}:${mm}`, style)} ${suffix}`;
}

/** «01:23:26» countdown; negative values clamp to zero. */
export function formatCountdown(ms: number, style: DigitStyle = 'latin'): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return digits(`${pad(h)}:${pad(m)}:${pad(s)}`, style);
}

/** «ساعة و23 د» style human duration, as used on the home banner. */
export function formatDurationWords(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const hours = h === 0 ? '' : h === 1 ? 'ساعة' : h === 2 ? 'ساعتان' : `${h} ساعات`;
  const hoursFinal = h > 10 ? `${h} ساعة` : hours;
  const minutes = m === 0 ? '' : `${m} د`;
  if (hoursFinal && minutes) return `${hoursFinal} و${minutes}`;
  return hoursFinal || minutes || 'أقل من دقيقة';
}
