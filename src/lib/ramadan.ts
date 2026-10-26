// The smart banner on the home screen: a Ramadan countdown in the weeks before, imsak and
// iftar countdowns during the month, and the next prayer the rest of the year.
import { addCivilDays, daysBetween, toGregorian, toHijri, type CivilDate } from './hijri';
import { computeDay, nextPrayer, type PlaceLocation, type PrayerId, type PrayerSettings } from './prayer-times';
import { civilDateIn } from './time';

export const RAMADAN_COUNTDOWN_DAYS = 60;

export type BannerState =
  | { kind: 'before-ramadan'; daysLeft: number; startsOn: CivilDate }
  | { kind: 'ramadan'; day: number; phase: 'until-imsak' | 'until-iftar'; target: Date }
  | { kind: 'eid'; name: 'الفطر' | 'الأضحى'; next: { id: PrayerId; at: Date } }
  | { kind: 'prayer'; id: PrayerId; at: Date };

export function bannerState(now: Date, place: PlaceLocation, settings: PrayerSettings): BannerState {
  const today = civilDateIn(now, place.timezone);
  const h = toHijri(today, settings.hijriOffset);
  const next = nextPrayer(now, place, settings);

  if (h.month === 9) {
    const times = computeDay(today, place, settings).times;
    if (now < times.fajr) return { kind: 'ramadan', day: h.day, phase: 'until-imsak', target: times.fajr };
    if (now < times.maghrib) return { kind: 'ramadan', day: h.day, phase: 'until-iftar', target: times.maghrib };
    // After iftar: tomorrow's imsak, unless Ramadan has ended (then the Eid banner takes over).
    const tomorrow = addCivilDays(today, 1);
    const ht = toHijri(tomorrow, settings.hijriOffset);
    if (ht.month === 9) {
      return { kind: 'ramadan', day: ht.day, phase: 'until-imsak', target: computeDay(tomorrow, place, settings).times.fajr };
    }
    return { kind: 'prayer', id: next.id, at: next.at };
  }
  if (h.month === 10 && h.day <= 3) return { kind: 'eid', name: 'الفطر', next: { id: next.id, at: next.at } };
  if (h.month === 12 && h.day >= 10 && h.day <= 13) return { kind: 'eid', name: 'الأضحى', next: { id: next.id, at: next.at } };

  const ramadanYear = h.month < 9 ? h.year : h.year + 1;
  const startsOn = toGregorian({ year: ramadanYear, month: 9, day: 1 }, settings.hijriOffset);
  const daysLeft = daysBetween(today, startsOn);
  if (daysLeft > 0 && daysLeft <= RAMADAN_COUNTDOWN_DAYS) return { kind: 'before-ramadan', daysLeft, startsOn };
  return { kind: 'prayer', id: next.id, at: next.at };
}

export type FastingSuggestion = { date: CivilDate; reason: 'monday' | 'thursday' | 'white-days' | 'arafah' | 'ashura' };

/** Recommended voluntary fasts in the coming `days` days (Mon/Thu, 13–15 of each month, Arafah, Ashura). */
export function upcomingVoluntaryFasts(from: CivilDate, days: number, hijriOffset = 0): FastingSuggestion[] {
  const out: FastingSuggestion[] = [];
  for (let i = 0; i < days; i++) {
    const date = addCivilDays(from, i);
    const h = toHijri(date, hijriOffset);
    // No voluntary fasting is suggested in Ramadan, on the Eid days or the days of Tashreeq.
    if (h.month === 9 || (h.month === 10 && h.day === 1) || (h.month === 12 && h.day >= 10 && h.day <= 13)) continue;
    const weekday = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
    if (h.month === 12 && h.day === 9) out.push({ date, reason: 'arafah' });
    else if (h.month === 1 && h.day === 10) out.push({ date, reason: 'ashura' });
    else if (h.day >= 13 && h.day <= 15) out.push({ date, reason: 'white-days' });
    else if (weekday === 1) out.push({ date, reason: 'monday' });
    else if (weekday === 4) out.push({ date, reason: 'thursday' });
  }
  return out;
}

export const FAST_REASON_LABEL: Record<FastingSuggestion['reason'], string> = {
  monday: 'صيام الاثنين',
  thursday: 'صيام الخميس',
  'white-days': 'الأيام البيض',
  arafah: 'صيام يوم عرفة',
  ashura: 'صيام يوم عاشوراء',
};

export const FAST_REASON_LABEL_EN: Record<FastingSuggestion['reason'], string> = {
  monday: 'Monday fast',
  thursday: 'Thursday fast',
  'white-days': 'The White Days',
  arafah: 'Day of Arafah',
  ashura: 'Day of Ashura',
};
