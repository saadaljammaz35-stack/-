// «أوقات النهي والضحى»: the times in which voluntary prayer is forbidden and the time of Duha,
// from the day's prayer times. The rising "a spear's length" and the noon standstill have no exact
// astronomical moment; they use the approximations of Ibn Baz and Ibn ʿUthaymin (about a quarter
// of an hour after sunrise, about ten minutes before the zenith).
import type { DayTimes } from './prayer-times';

export const RISE_MINUTES = 15;
export const ZENITH_MINUTES = 10;

export type ForbiddenId = 'after-fajr' | 'sunrise' | 'zenith' | 'after-asr';
export type Window = { id: ForbiddenId | 'duha'; from: Date; to: Date };

const add = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000);

export function prayerWindows(t: Pick<DayTimes['times'], 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib'>): { forbidden: Window[]; duha: Window } {
  const risen = add(t.sunrise, RISE_MINUTES);
  const zenith = add(t.dhuhr, -ZENITH_MINUTES);
  return {
    forbidden: [
      { id: 'after-fajr', from: t.fajr, to: t.sunrise },
      { id: 'sunrise', from: t.sunrise, to: risen },
      { id: 'zenith', from: zenith, to: t.dhuhr },
      { id: 'after-asr', from: t.asr, to: t.maghrib },
    ],
    duha: { id: 'duha', from: risen, to: zenith },
  };
}

/** The forbidden window `now` falls in, if any. */
export function forbiddenNow(now: Date, windows: Window[]): Window | null {
  return windows.find((w) => now >= w.from && now < w.to) ?? null;
}
