// Appointments in the user's own calendars that cover the start of a prayer, so they can plan
// around it. Only the overlap is reported; how to arrange the prayer is left to the user.
import { SALAH_IDS, type DayTimes, type PrayerId } from './prayer-times';

export type CalendarItem = { id: string; title: string; start: Date; end: Date; allDay: boolean };
export type Conflict = { item: CalendarItem; prayer: PrayerId; at: Date; isFriday: boolean };

/** An appointment conflicts when the prayer's time falls inside it, or it starts within `leadMin` after the adhan. */
export function prayerConflicts(items: CalendarItem[], days: DayTimes[], leadMin = 10): Conflict[] {
  const out: Conflict[] = [];
  for (const item of items) {
    if (item.allDay || item.end <= item.start) continue;
    for (const day of days) {
      for (const prayer of SALAH_IDS) {
        const at = day.times[prayer];
        const inside = item.start <= at && at < item.end;
        const right = item.start > at && item.start.getTime() - at.getTime() <= leadMin * 60_000;
        if (inside || right) out.push({ item, prayer, at, isFriday: day.isFriday });
      }
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime() || a.item.start.getTime() - b.item.start.getTime());
}
