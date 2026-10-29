// «خطة القضاء»: spreading the prayers and fasts owed over a schedule the user can keep.
import { addCivilDays, civilWeekday, type CivilDate } from './hijri';
import type { FardId } from './prayer-log';
import { noVoluntaryFast } from './virtues';

/** Days needed to make up the prayers owed with `perPrayer` extra prayers alongside each daily one. */
export function prayerPlanDays(owed: Record<FardId, number>, perPrayer: number): number {
  const n = Math.max(1, Math.round(perPrayer));
  return Math.max(0, ...Object.values(owed).map((c) => Math.ceil(c / n)));
}

/**
 * The next `count` days for making up fasts on the chosen weekdays (0 = Sunday … 6 = Saturday),
 * from `from` (inclusive). Days on which fasting is not allowed or not for qada (Ramadan, the two
 * Eids, the days of Tashreeq) are skipped, and a Friday is used only next to a Thursday or Saturday.
 */
export function fastPlanDates(from: CivilDate, count: number, weekdays: number[], hijriOffset = 0, limitDays = 800): CivilDate[] {
  const days = new Set(weekdays);
  const out: CivilDate[] = [];
  if (!days.size || count <= 0) return out;
  const friday = days.has(5) && (days.has(4) || days.has(6));
  for (let i = 0; i < limitDays && out.length < count; i++) {
    const d = addCivilDays(from, i);
    const w = civilWeekday(d);
    if (!days.has(w) || noVoluntaryFast(d, hijriOffset)) continue;
    if (w === 5 && !friday) continue;
    out.push(d);
  }
  return out;
}
