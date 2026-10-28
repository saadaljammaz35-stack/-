import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import type { CivilDate } from '@/lib/hijri';
import { computeDay, nextPrayer, type DayTimes, type NextPrayer } from '@/lib/prayer-times';
import { civilDateIn } from '@/lib/time';
import { useSettings } from '@/store/settings';

let scrollingUntil = 0;

/**
 * Wired to the main scroll views: while the user drags or a fling is settling, periodic
 * clock re-renders (`useNow(…, { yieldToScroll: true })`) wait, so a scroll never stutters.
 */
export const scrollActivity = {
  begin: () => {
    scrollingUntil = Date.now() + 5000;
  },
  end: () => {
    scrollingUntil = Date.now() + 250;
  },
};

/**
 * The current time, refreshed every `intervalMs` while the app is in the foreground and also
 * exactly at `alsoAt` (ms), if given. With `yieldToScroll`, the periodic refresh waits for a
 * scroll in progress to settle.
 */
export function useNow(intervalMs = 1000, alsoAt?: number, { yieldToScroll = false } = {}): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (alsoAt == null) return;
    const wait = alsoAt - Date.now() + 50;
    if (wait <= 0 || wait > 2_000_000_000) return;
    const t = setTimeout(() => setNow(new Date()), wait);
    return () => clearTimeout(t);
  }, [alsoAt]);
  useEffect(() => {
    let retry: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      if (retry) clearTimeout(retry);
      retry = null;
      const busy = yieldToScroll ? scrollingUntil - Date.now() : 0;
      if (busy > 0) retry = setTimeout(tick, Math.min(busy, 1000));
      else setNow(new Date());
    };
    let id: ReturnType<typeof setInterval> | null = setInterval(tick, intervalMs);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setNow(new Date());
        if (!id) id = setInterval(tick, intervalMs);
      } else if (id) {
        clearInterval(id);
        id = null;
      }
    });
    return () => {
      if (id) clearInterval(id);
      if (retry) clearTimeout(retry);
      sub.remove();
    };
  }, [intervalMs, yieldToScroll]);
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
