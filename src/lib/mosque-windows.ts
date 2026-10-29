// «صامت في المسجد»: the times the phone should be silent for the prayer in the mosque, from just
// before the iqama until the prayer is over (on Friday, from before the khutbah).
import { addCivilDays, type CivilDate } from './hijri';
import type { FardId } from './prayer-log';
import { computeDay, type PlaceLocation, type PrayerSettings } from './prayer-times';

export type SilentWindow = { prayer: FardId; friday: boolean; start: Date; end: Date };

export const FRIDAY_SILENT = { before: 10, after: 50 };

export function mosqueWindows(input: {
  today: CivilDate;
  now: Date;
  place: PlaceLocation;
  prayer: PrayerSettings;
  iqama: Record<FardId, number>;
  prayers: FardId[];
  /** How long the phone stays silent from 2 minutes before the iqama. */
  minutes: number;
  days?: number;
}): SilentWindow[] {
  const out: SilentWindow[] = [];
  for (let i = 0; i < (input.days ?? 3); i++) {
    const day = computeDay(addCivilDays(input.today, i), input.place, input.prayer);
    for (const id of input.prayers) {
      const adhan = day.times[id].getTime();
      const friday = day.isFriday && id === 'dhuhr';
      const start = friday ? adhan - FRIDAY_SILENT.before * 60_000 : adhan + (input.iqama[id] - 2) * 60_000;
      const end = friday ? adhan + FRIDAY_SILENT.after * 60_000 : start + input.minutes * 60_000;
      if (end > input.now.getTime()) out.push({ prayer: id, friday, start: new Date(start), end: new Date(end) });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
