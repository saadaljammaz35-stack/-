import { addCivilDays, civilWeekday, toGregorian, toHijri } from '../hijri';
import { DEFAULT_NOTIFICATION_SETTINGS, planNotifications } from '../notification-plan';
import { computeDay, DEFAULT_PRAYER_SETTINGS, type PlaceLocation } from '../prayer-times';
import { upcomingVoluntaryFasts } from '../ramadan';
import { instantAt } from '../time';
import { NIGHT_HADITH, SEASONS, seasonOn, upcomingOccasions, VIRTUES, virtuesOn } from '../virtues';

const riyadh: PlaceLocation = { name: 'الرياض', lat: 24.7136, lng: 46.6753, timezone: 'Asia/Riyadh', source: 'manual' };
const hijri = (year: number, month: number, day: number) => toGregorian({ year, month, day });

describe('virtuous days', () => {
  it('marks Arafah, Tasu‘a and Ashura', () => {
    expect(virtuesOn(hijri(1448, 12, 9))).toContain('arafah');
    expect(virtuesOn(hijri(1449, 1, 9))).toContain('tasua');
    expect(virtuesOn(hijri(1449, 1, 10))).toContain('ashura');
  });

  it('marks the white days and Mondays and Thursdays outside Ramadan', () => {
    for (const d of [13, 14, 15]) expect(virtuesOn(hijri(1448, 5, d))).toContain('white-days');
    expect(virtuesOn(hijri(1448, 5, 12))).not.toContain('white-days');
    for (let i = 0; i < 7; i++) {
      const date = addCivilDays(hijri(1448, 5, 1), i);
      const w = civilWeekday(date);
      expect(virtuesOn(date).includes('monday')).toBe(w === 1);
      expect(virtuesOn(date).includes('thursday')).toBe(w === 4);
    }
  });

  it('suggests no fast in Ramadan, on Eid or the days of Tashreeq, but keeps Friday', () => {
    for (let d = 1; d <= 29; d++) expect(virtuesOn(hijri(1448, 9, d)).filter((v) => VIRTUES[v].fast)).toEqual([]);
    expect(virtuesOn(hijri(1448, 10, 1)).filter((v) => VIRTUES[v].fast)).toEqual([]);
    for (const d of [10, 11, 12, 13]) expect(virtuesOn(hijri(1448, 12, d)).filter((v) => VIRTUES[v].fast)).toEqual([]);
    const friday = [0, 1, 2, 3, 4, 5, 6].map((i) => addCivilDays(hijri(1448, 9, 1), i)).find((d) => civilWeekday(d) === 5)!;
    expect(virtuesOn(friday)).toEqual(['friday']);
  });

  it('finds the seasons and the day within them', () => {
    expect(seasonOn(hijri(1448, 9, 21))).toEqual({ id: 'ramadan-last-ten', day: 1 });
    expect(seasonOn(hijri(1448, 9, 20))).toBeNull();
    expect(seasonOn(hijri(1448, 10, 2))).toEqual({ id: 'shawwal-six', day: 1 });
    expect(seasonOn(hijri(1448, 10, 1))).toBeNull();
    expect(seasonOn(hijri(1448, 12, 10))).toEqual({ id: 'dhul-hijjah-ten', day: 10 });
    expect(seasonOn(hijri(1449, 1, 15))).toEqual({ id: 'muharram', day: 15 });
  });

  it('lists upcoming occasions with season starts', () => {
    const from = hijri(1448, 11, 28);
    const list = upcomingOccasions(from, 14);
    const start = list.find((o) => o.seasonStarts === 'dhul-hijjah-ten')!;
    expect(toHijri(start.date)).toMatchObject({ month: 12, day: 1 });
    expect(list.some((o) => o.virtues.includes('arafah'))).toBe(true);
    // A season already under way is not announced again.
    expect(upcomingOccasions(hijri(1448, 12, 5), 3).every((o) => o.seasonStarts === null)).toBe(true);
  });

  it('names a hadith for every virtue, season and the night', () => {
    for (const v of Object.values(VIRTUES)) expect(v.hadith.length).toBeGreaterThan(0);
    for (const s of Object.values(SEASONS)) expect(s.hadith.length).toBeGreaterThan(0);
    expect(NIGHT_HADITH).toBeGreaterThan(0);
  });

  it('adds Tasu‘a to the voluntary fasts and prefers the specific reason', () => {
    expect(upcomingVoluntaryFasts(hijri(1449, 1, 9), 2).map((f) => f.reason)).toEqual(['tasua', 'ashura']);
    expect(upcomingVoluntaryFasts(hijri(1448, 12, 9), 1)[0].reason).toBe('arafah');
  });
});

describe('night and season reminders', () => {
  const settings = { ...DEFAULT_NOTIFICATION_SETTINGS, qiyam: { enabled: true }, seasons: { enabled: true } };

  it('reminds at the start of the last third of each night', () => {
    const now = instantAt(hijri(1448, 5, 10), 12, 0, riyadh.timezone);
    const plan = planNotifications({ now, place: riyadh, prayer: DEFAULT_PRAYER_SETTINGS, settings, days: 3, limit: 200 });
    const qiyam = plan.filter((p) => p.id.startsWith('qiyam-'));
    expect(qiyam).toHaveLength(3);
    qiyam.forEach((q, i) => {
      // The night runs from this day's Maghrib to the next day's Fajr; its last third starts two thirds in.
      const date = addCivilDays(hijri(1448, 5, 10), i);
      const maghrib = computeDay(date, riyadh, DEFAULT_PRAYER_SETTINGS).times.maghrib.getTime();
      const fajr = computeDay(addCivilDays(date, 1), riyadh, DEFAULT_PRAYER_SETTINGS).times.fajr.getTime();
      expect(Math.abs(q.at.getTime() - (fajr - (fajr - maghrib) / 3))).toBeLessThanOrEqual(60_000);
    });
  });

  it('announces the last ten nights on the evening of the 20th of Ramadan', () => {
    const now = instantAt(hijri(1448, 9, 18), 12, 0, riyadh.timezone);
    const plan = planNotifications({ now, place: riyadh, prayer: DEFAULT_PRAYER_SETTINGS, settings, days: 5, limit: 200 });
    const season = plan.find((p) => p.id.startsWith('season-ramadan-last-ten'))!;
    expect(season).toBeDefined();
    const eve = hijri(1448, 9, 20);
    expect(season.at.getTime()).toBeGreaterThan(instantAt(eve, 17, 0, riyadh.timezone).getTime());
    expect(season.at.getTime()).toBeLessThan(instantAt(eve, 20, 0, riyadh.timezone).getTime());
  });

  it('sends neither when switched off', () => {
    const now = instantAt(hijri(1448, 9, 18), 12, 0, riyadh.timezone);
    const off = { ...settings, qiyam: { enabled: false }, seasons: { enabled: false } };
    const plan = planNotifications({ now, place: riyadh, prayer: DEFAULT_PRAYER_SETTINGS, settings: off, days: 5, limit: 200 });
    expect(plan.some((p) => p.id.startsWith('qiyam-') || p.id.startsWith('season-'))).toBe(false);
  });
});
