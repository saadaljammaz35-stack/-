// Destinations that depend on the moment: shared by the icon's quick actions, Siri and the
// /adhkar/now and /wird routes.
import { addCivilDays } from '@/lib/hijri';
import { status as khatmaStatus } from '@/lib/khatma';
import { computeDay } from '@/lib/prayer-times';
import { civilDateIn } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { useKhatmaStore, useQuranStore } from '@/store/user';

/** Morning adhkar from Fajr until Asr, evening adhkar from Asr until the next Fajr. */
export function adhkarOfTheMoment(now = new Date()): 'morning' | 'evening' {
  const { location, prayer } = useSettings.getState();
  if (!location) return now.getHours() >= 4 && now.getHours() < 15 ? 'morning' : 'evening';
  const today = civilDateIn(now, location.timezone);
  const day = computeDay(today, location, prayer);
  if (now < day.times.fajr) return 'evening';
  return now < day.times.asr ? 'morning' : 'evening';
}

/** Today's khatma portion, or the mushaf page where reading stopped. */
export function wirdRoute(now = new Date()): string {
  const { location } = useSettings.getState();
  const khatma = useKhatmaStore.getState().khatmas.find((k) => k.status === 'active');
  if (khatma) {
    const today = location ? civilDateIn(now, location.timezone) : civilDateIn(now, Intl.DateTimeFormat().resolvedOptions().timeZone);
    const portion = khatmaStatus(khatma, today).today ?? khatmaStatus(khatma, addCivilDays(today, 1)).today;
    if (portion) return `/mushaf?page=${Math.max(portion.from, khatma.progress + 1)}`;
  }
  const last = useQuranStore.getState().lastRead;
  return last ? `/mushaf?page=${last.page}` : '/quran';
}
