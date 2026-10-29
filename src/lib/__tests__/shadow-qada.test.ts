import { civilWeekday, toGregorian, toHijri } from '../hijri';
import { mosqueWindows } from '../mosque-windows';
import { computeDay, DEFAULT_PRAYER_SETTINGS, type PlaceLocation } from '../prayer-times';
import { fastPlanDates, prayerPlanDays } from '../qada';
import { noonShadowRatio, shadowAt, shadowRatio } from '../shadow';

const riyadh: PlaceLocation = { name: 'الرياض', lat: 24.7136, lng: 46.6753, timezone: 'Asia/Riyadh', source: 'manual' };

describe('Asr shadow', () => {
  it('a 45° sun casts a shadow as long as the object', () => {
    expect(shadowRatio(45)).toBeCloseTo(1, 6);
    expect(shadowRatio(-3)).toBeNull();
    expect(noonShadowRatio(24.7, 24.7)).toBeCloseTo(0, 6);
  });

  it('at the timetable’s Asr, the shadow is the noon shadow plus the object’s height', () => {
    for (const madhab of ['shafi', 'hanafi'] as const) {
      const day = computeDay({ year: 2026, month: 1, day: 10 }, riyadh, { ...DEFAULT_PRAYER_SETTINGS, madhab });
      const s = shadowAt(day.times.asr, riyadh.lat, riyadh.lng, madhab);
      // Within a minute's worth of shadow growth.
      expect(Math.abs(s.ratio! - s.asr)).toBeLessThan(0.03);
    }
  });
});

describe('qada plan', () => {
  it('counts the days for prayers owed', () => {
    expect(prayerPlanDays({ fajr: 10, dhuhr: 4, asr: 0, maghrib: 7, isha: 3 }, 1)).toBe(10);
    expect(prayerPlanDays({ fajr: 10, dhuhr: 4, asr: 0, maghrib: 7, isha: 3 }, 3)).toBe(4);
    expect(prayerPlanDays({ fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, 2)).toBe(0);
  });

  it('schedules fasts on the chosen weekdays, never in Ramadan, on Eid or the days of Tashreeq', () => {
    const from = toGregorian({ year: 1448, month: 8, day: 20 });
    const dates = fastPlanDates(from, 12, [1, 4]);
    expect(dates).toHaveLength(12);
    for (const d of dates) {
      expect([1, 4]).toContain(civilWeekday(d));
      const h = toHijri(d);
      expect(h.month).not.toBe(9);
      expect(h.month === 10 && h.day === 1).toBe(false);
    }
    // Friday alone is skipped; with Thursday it is allowed.
    expect(fastPlanDates(from, 5, [5]).length).toBe(0);
    expect(fastPlanDates(from, 6, [4, 5]).some((d) => civilWeekday(d) === 5)).toBe(true);
  });
});

describe('silent at the mosque', () => {
  it('silences from two minutes before the iqama, and before the khutbah on Friday', () => {
    const friday = { year: 2026, month: 10, day: 30 };
    expect(civilWeekday(friday)).toBe(5);
    const day = computeDay(friday, riyadh, DEFAULT_PRAYER_SETTINGS);
    const iqama = { fajr: 25, dhuhr: 20, asr: 20, maghrib: 10, isha: 20 };
    const w = mosqueWindows({ today: friday, now: new Date(day.times.fajr.getTime() - 3600_000), place: riyadh, prayer: DEFAULT_PRAYER_SETTINGS, iqama, prayers: ['fajr', 'dhuhr', 'maghrib'], minutes: 20, days: 1 });
    expect(w.map((x) => x.prayer)).toEqual(['fajr', 'dhuhr', 'maghrib']);
    expect(w[0].start.getTime()).toBe(day.times.fajr.getTime() + 23 * 60_000);
    expect(w[0].end.getTime() - w[0].start.getTime()).toBe(20 * 60_000);
    expect(w[1].friday).toBe(true);
    expect(w[1].start.getTime()).toBe(day.times.dhuhr.getTime() - 10 * 60_000);
    expect(w[2].start.getTime()).toBe(day.times.maghrib.getTime() + 8 * 60_000);
  });
});
