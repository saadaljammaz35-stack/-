// «صلاتي»: a private log of the five daily prayers (in congregation, on time, late or missed),
// the prayers owed (qada) and a few voluntary prayers, with weekly summaries and streaks.
import { addCivilDays, civilKey, type CivilDate } from './hijri';

export type FardId = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export const FARD_IDS: FardId[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export type PrayerMark = 'jamaah' | 'ontime' | 'late' | 'missed';
export const PRAYER_MARKS: PrayerMark[] = ['jamaah', 'ontime', 'late', 'missed'];

/** The twelve regular sunnah rak‘ahs (al-rawatib), by their place around the obligatory prayers. */
export type RatibaId = 'r-fajr' | 'r-dhuhr-before' | 'r-dhuhr-after' | 'r-maghrib' | 'r-isha';
export const RAWATIB_IDS: RatibaId[] = ['r-fajr', 'r-dhuhr-before', 'r-dhuhr-after', 'r-maghrib', 'r-isha'];
/** Rak‘ahs of each, per the hadith of Umm Habibah with ʿAʾishah's four before Dhuhr. */
export const RATIBA_RAKAHS: Record<RatibaId, number> = { 'r-fajr': 2, 'r-dhuhr-before': 4, 'r-dhuhr-after': 2, 'r-maghrib': 2, 'r-isha': 2 };

export type NafilaId = 'duha' | 'witr' | 'qiyam' | RatibaId;
export const NAFILA_IDS: NafilaId[] = ['duha', 'witr', 'qiyam'];

export type DayLog = Partial<Record<FardId, PrayerMark>> & { nafila?: Partial<Record<NafilaId, true>> };
export type PrayerLog = { days: Record<string, DayLog>; qada: Record<FardId, number> };

export const EMPTY_QADA: Record<FardId, number> = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };

/**
 * Sets (or clears, with null) one prayer's mark. Marking a prayer missed adds it to the prayers
 * owed, and changing that mark takes it off again, so the qada count follows the log.
 */
export function markPrayer(log: PrayerLog, date: CivilDate, id: FardId, mark: PrayerMark | null): PrayerLog {
  const key = civilKey(date);
  const day: DayLog = { ...log.days[key] };
  const before = day[id];
  if (mark) day[id] = mark;
  else delete day[id];
  const qada = { ...log.qada };
  if (before === 'missed' && mark !== 'missed') qada[id] = Math.max(0, qada[id] - 1);
  if (mark === 'missed' && before !== 'missed') qada[id] += 1;
  return { days: { ...log.days, [key]: day }, qada };
}

export function toggleNafila(log: PrayerLog, date: CivilDate, id: NafilaId): PrayerLog {
  const key = civilKey(date);
  const day: DayLog = { ...log.days[key] };
  const nafila = { ...day.nafila };
  if (nafila[id]) delete nafila[id];
  else nafila[id] = true;
  day.nafila = nafila;
  return { ...log, days: { ...log.days, [key]: day } };
}

export function adjustQada(log: PrayerLog, id: FardId, delta: number): PrayerLog {
  return { ...log, qada: { ...log.qada, [id]: Math.max(0, log.qada[id] + delta) } };
}

/** All five prayed (in any way but missed). */
export function isCompleteDay(day: DayLog | undefined): boolean {
  return Boolean(day) && FARD_IDS.every((id) => day![id] && day![id] !== 'missed');
}

/** Consecutive complete days ending today (or yesterday, while today is still in progress). */
export function streak(log: PrayerLog, today: CivilDate): number {
  let d = isCompleteDay(log.days[civilKey(today)]) ? today : addCivilDays(today, -1);
  let n = 0;
  while (isCompleteDay(log.days[civilKey(d)])) {
    n++;
    d = addCivilDays(d, -1);
  }
  return n;
}

export type MarkCounts = Record<PrayerMark, number> & { unmarked: number };

export function countMarks(log: PrayerLog, from: CivilDate, days: number): MarkCounts {
  const out: MarkCounts = { jamaah: 0, ontime: 0, late: 0, missed: 0, unmarked: 0 };
  for (let i = 0; i < days; i++) {
    const day = log.days[civilKey(addCivilDays(from, i))];
    for (const id of FARD_IDS) {
      const m = day?.[id];
      if (m) out[m]++;
      else out.unmarked++;
    }
  }
  return out;
}

/** The seven days ending on `today`, oldest first, each with its marks. */
export function lastWeek(log: PrayerLog, today: CivilDate): { date: CivilDate; day: DayLog }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addCivilDays(today, i - 6);
    return { date, day: log.days[civilKey(date)] ?? {} };
  });
}

/** Rak‘ahs of the rawatib logged on a day, out of twelve. */
export function rawatibRakahs(day: DayLog | undefined): number {
  return RAWATIB_IDS.reduce((n, id) => n + (day?.nafila?.[id] ? RATIBA_RAKAHS[id] : 0), 0);
}

/** Days, ending today, in a row on which witr was logged (today counts once logged, else from yesterday). */
export function witrStreak(log: PrayerLog, today: CivilDate): number {
  let d = log.days[civilKey(today)]?.nafila?.witr ? today : addCivilDays(today, -1);
  let n = 0;
  while (log.days[civilKey(d)]?.nafila?.witr && n < 3650) {
    n += 1;
    d = addCivilDays(d, -1);
  }
  return n;
}
