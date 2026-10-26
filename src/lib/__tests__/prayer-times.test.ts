import { Coordinates, Qibla } from 'adhan';

import { toGregorian } from '../hijri';
import {
  computeDay,
  computeMonth,
  DEFAULT_PRAYER_SETTINGS,
  nextPrayer,
  prayerLabel,
  type PlaceLocation,
} from '../prayer-times';
import { qiblaBearing, distanceToKaabaKm } from '../qibla';
import { formatTime, instantAt } from '../time';

const riyadh: PlaceLocation = { name: 'الرياض', lat: 24.7136, lng: 46.6753, timezone: 'Asia/Riyadh', source: 'manual' };
const t = (d: Date) => formatTime(d, 'Asia/Riyadh', 'latin', true);

describe('prayer times (Umm al-Qura)', () => {
  it('matches the published Riyadh times for Saturday 24 October 2026', () => {
    const day = computeDay({ year: 2026, month: 10, day: 24 }, riyadh, DEFAULT_PRAYER_SETTINGS);
    expect(t(day.times.fajr)).toBe('04:37');
    expect(t(day.times.sunrise)).toBe('05:56');
    expect(t(day.times.dhuhr)).toBe('11:38');
    expect(t(day.times.asr)).toBe('14:53');
    expect(t(day.times.maghrib)).toBe('17:19');
    expect(t(day.times.isha)).toBe('18:49');
    expect(t(day.midnight)).toBe('22:58');
    expect(day.isFriday).toBe(false);
  });

  it('adds 30 minutes to Isha during Ramadan', () => {
    const ramadanDay = toGregorian({ year: 1448, month: 9, day: 5 });
    const day = computeDay(ramadanDay, riyadh, DEFAULT_PRAYER_SETTINGS);
    const minutes = (day.times.isha.getTime() - day.times.maghrib.getTime()) / 60000;
    expect(minutes).toBe(120);
    const off = computeDay(ramadanDay, riyadh, { ...DEFAULT_PRAYER_SETTINGS, ramadanIsha: false });
    expect((off.times.isha.getTime() - off.times.maghrib.getTime()) / 60000).toBe(90);
  });

  it('computes a later Asr for the Hanafi madhhab', () => {
    const date = { year: 2026, month: 10, day: 24 };
    const shafi = computeDay(date, riyadh, DEFAULT_PRAYER_SETTINGS);
    const hanafi = computeDay(date, riyadh, { ...DEFAULT_PRAYER_SETTINGS, madhab: 'hanafi' });
    expect(hanafi.times.asr.getTime()).toBeGreaterThan(shafi.times.asr.getTime() + 30 * 60000);
  });

  it('applies manual minute adjustments', () => {
    const date = { year: 2026, month: 10, day: 24 };
    const adjusted = computeDay(date, riyadh, {
      ...DEFAULT_PRAYER_SETTINGS,
      adjustments: { ...DEFAULT_PRAYER_SETTINGS.adjustments, fajr: 2 },
    });
    expect(t(adjusted.times.fajr)).toBe('04:39');
  });

  it('finds the next prayer and counts across midnight', () => {
    const at1329 = instantAt({ year: 2026, month: 10, day: 24 }, 13, 29, 'Asia/Riyadh');
    const next = nextPrayer(at1329, riyadh, DEFAULT_PRAYER_SETTINGS);
    expect(next.id).toBe('asr');
    expect(Math.round((next.at.getTime() - at1329.getTime()) / 60000)).toBe(84);
    expect(next.previous?.id).toBe('dhuhr');

    const lateNight = instantAt({ year: 2026, month: 10, day: 24 }, 23, 30, 'Asia/Riyadh');
    const fajr = nextPrayer(lateNight, riyadh, DEFAULT_PRAYER_SETTINGS);
    expect(fajr.id).toBe('fajr');
    expect(fajr.day.date).toEqual({ year: 2026, month: 10, day: 25 });
  });

  it('labels Dhuhr as Jumu‘ah on Fridays', () => {
    const friday = computeDay({ year: 2026, month: 10, day: 23 }, riyadh, DEFAULT_PRAYER_SETTINGS);
    expect(friday.isFriday).toBe(true);
    expect(prayerLabel('dhuhr', friday.isFriday)).toBe('الجمعة');
  });

  it('builds a full monthly table', () => {
    const month = computeMonth(2027, 2, riyadh, DEFAULT_PRAYER_SETTINGS);
    expect(month).toHaveLength(28);
    for (const d of month) expect(d.times.fajr < d.times.sunrise && d.times.maghrib < d.times.isha).toBe(true);
  });

  it('works in zones with daylight saving time', () => {
    const london: PlaceLocation = { name: 'London', lat: 51.5072, lng: -0.1276, timezone: 'Europe/London', source: 'manual' };
    const day = computeDay({ year: 2026, month: 3, day: 29 }, london, { ...DEFAULT_PRAYER_SETTINGS, method: 'MuslimWorldLeague' });
    expect(day.times.dhuhr.getTime()).toBeLessThan(day.times.asr.getTime());
    expect(formatTime(day.times.dhuhr, 'Europe/London', 'latin', true).startsWith('13:')).toBe(true);
  });
});

describe('qibla', () => {
  it('agrees with the adhan library bearing for several cities', () => {
    for (const [lat, lng] of [
      [24.7136, 46.6753],
      [30.0444, 31.2357],
      [51.5072, -0.1276],
      [-6.2088, 106.8456],
      [40.7128, -74.006],
    ]) {
      expect(qiblaBearing(lat, lng)).toBeCloseTo(Qibla(new Coordinates(lat, lng)), 0);
    }
  });

  it('measures the distance from Riyadh to the Kaaba', () => {
    const km = distanceToKaabaKm(24.7136, 46.6753);
    expect(km).toBeGreaterThan(780);
    expect(km).toBeLessThan(800);
  });
});
