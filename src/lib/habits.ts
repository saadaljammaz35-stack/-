// «عاداتي»: good habits ticked day by day, «صلة الرحم»: relatives to keep in touch with on a rhythm
// the user sets, and the sleep calculator that works back from Fajr.
import { addCivilDays, civilKey, type CivilDate } from './hijri';

export type Habit = { id: string; ar: string; en: string; /** Days are civil keys. */ days: string[]; custom?: boolean };

/** Days in a row, ending today (or yesterday while today is not yet ticked). */
export function habitStreak(days: string[], today: CivilDate): number {
  const set = new Set(days);
  let d = set.has(civilKey(today)) ? today : addCivilDays(today, -1);
  let n = 0;
  while (set.has(civilKey(d)) && n < 3650) {
    n += 1;
    d = addCivilDays(d, -1);
  }
  return n;
}

/** The last seven days, oldest first, with whether each was ticked. */
export function lastSevenDays(days: string[], today: CivilDate): { date: CivilDate; done: boolean }[] {
  const set = new Set(days);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addCivilDays(today, i - 6);
    return { date, done: set.has(civilKey(date)) };
  });
}

export type Relative = { id: string; name: string; everyDays: number; /** Civil key of the last contact, or null. */ last: string | null };

/** The day a relative is next due a call (today when never contacted). */
export function relativeDue(r: Relative, today: CivilDate): string {
  if (!r.last) return civilKey(today);
  const [y, m, d] = r.last.split('-').map(Number);
  return civilKey(addCivilDays({ year: y, month: m, day: d }, r.everyDays));
}

/** Relatives due today or overdue, most overdue first. */
export function relativesDue(list: Relative[], today: CivilDate): Relative[] {
  const key = civilKey(today);
  return list.filter((r) => relativeDue(r, today) <= key).sort((a, b) => (relativeDue(a, today) < relativeDue(b, today) ? -1 : 1));
}

/** Bedtimes for whole 90-minute sleep cycles ending at `wake`, allowing `fallAsleep` minutes. */
export function bedtimes(wake: Date, cycles: number[] = [6, 5, 4], fallAsleep = 15): { cycles: number; at: Date; hours: number }[] {
  return cycles.map((c) => ({ cycles: c, at: new Date(wake.getTime() - (c * 90 + fallAsleep) * 60_000), hours: (c * 90) / 60 }));
}
