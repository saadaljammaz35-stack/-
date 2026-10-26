import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import type { CivilDate } from '@/lib/hijri';
import { computeDay, nextPrayer, type DayTimes, type NextPrayer } from '@/lib/prayer-times';
import { civilDateIn } from '@/lib/time';
import { useSettings } from '@/store/settings';

/** Current time, re-rendering every `intervalMs` while the app is in the foreground. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = setInterval(() => setNow(new Date()), intervalMs);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setNow(new Date());
        if (!id) id = setInterval(() => setNow(new Date()), intervalMs);
      } else if (id) {
        clearInterval(id);
        id = null;
      }
    });
    return () => {
      if (id) clearInterval(id);
      sub.remove();
    };
  }, [intervalMs]);
  return now;
}

export function useTimeZone(): string {
  const location = useSettings((s) => s.location);
  return location?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

/** Today's civil date in the selected location's time zone. */
export function useToday(now?: Date): CivilDate {
  const tz = useTimeZone();
  const instant = now ?? new Date();
  const key = civilDateIn(instant, tz);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => key, [key.year, key.month, key.day]);
}

export type PrayerInfo = { day: DayTimes; next: NextPrayer } | null;

/** Today's times and the next prayer; recomputed only when a prayer time passes or settings change. */
export function usePrayerInfo(now: Date): PrayerInfo {
  const location = useSettings((s) => s.location);
  const settings = useSettings((s) => s.prayer);
  const [state, setState] = useState<{ info: PrayerInfo; location: typeof location; settings: typeof settings } | null>(null);
  const stale =
    !state ||
    state.location !== location ||
    state.settings !== settings ||
    (state.info !== null && now.getTime() >= state.info.next.at.getTime()) ||
    (state.info !== null && location !== null && civilDateIn(now, location.timezone).day !== state.info.day.date.day);
  if (stale) {
    // Derived state stored during render (React's "information from previous renders" pattern).
    const info = location
      ? { day: computeDay(civilDateIn(now, location.timezone), location, settings), next: nextPrayer(now, location, settings) }
      : null;
    setState({ info, location, settings });
    return info;
  }
  return state.info;
}
