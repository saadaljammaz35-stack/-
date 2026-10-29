import { courseTo, flightPrayerTimes, horizonDip, pointAlong } from '../flight';
import { computeDay, DEFAULT_PRAYER_SETTINGS, type PlaceLocation } from '../prayer-times';
import { instantAt } from '../time';

const riyadh: PlaceLocation = { name: 'الرياض', lat: 24.7136, lng: 46.6753, timezone: 'Asia/Riyadh', source: 'manual' };
const london = { lat: 51.47, lng: -0.4543 };
const newYork = { lat: 40.6413, lng: -73.7781 };

describe('great circle', () => {
  it('starts and ends at the airports and heads the right way', () => {
    expect(pointAlong(riyadh, london, 0).lat).toBeCloseTo(riyadh.lat, 6);
    const end = pointAlong(riyadh, london, 1);
    expect(end.lat).toBeCloseTo(london.lat, 6);
    expect(end.lng).toBeCloseTo(london.lng, 6);
    // Riyadh to London is north-west.
    const c = courseTo(riyadh, london);
    expect(c).toBeGreaterThan(290);
    expect(c).toBeLessThan(330);
  });

  it('dips the horizon by about three degrees at cruising altitude', () => {
    expect(horizonDip(11)).toBeCloseTo(3.08, 1);
    expect(horizonDip(0)).toBe(0);
  });
});

describe('prayer times on a flight', () => {
  it('on the ground, a whole day matches the prayer timetable', () => {
    // Outside Ramadan, when Umm al-Qura's Isha is 120 minutes after Maghrib.
    const date = { year: 2026, month: 5, day: 15 };
    const day = computeDay(date, riyadh, DEFAULT_PRAYER_SETTINGS);
    const events = flightPrayerTimes({ from: riyadh, to: riyadh, departure: instantAt(date, 0, 0, riyadh.timezone), durationMin: 24 * 60, method: DEFAULT_PRAYER_SETTINGS.method, madhab: 'shafi', altitudeKm: 0 });
    expect(events.map((e) => e.id)).toEqual(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']);
    for (const e of events) {
      // adhan rounds to the minute.
      expect([e.id, Math.abs(e.at.getTime() - day.times[e.id].getTime()) < 2 * 60_000]).toEqual([e.id, true]);
    }
  });

  it('a westbound afternoon flight keeps the sun up longer and gives the qibla relative to the nose', () => {
    const departure = new Date('2026-05-15T13:00:00Z'); // 16:00 in Riyadh, before Maghrib there
    const events = flightPrayerTimes({ from: riyadh, to: newYork, departure, durationMin: 13 * 60, method: 'UmmAlQura', madhab: 'shafi' });
    const ids = events.map((e) => e.id);
    expect(ids).toContain('maghrib');
    const maghrib = events.find((e) => e.id === 'maghrib')!;
    // Flying west delays sunset by hours compared with Riyadh.
    const riyadhMaghrib = computeDay({ year: 2026, month: 5, day: 15 }, riyadh, DEFAULT_PRAYER_SETTINGS).times.maghrib;
    expect(maghrib.at.getTime() - riyadhMaghrib.getTime()).toBeGreaterThan(90 * 60_000);
    // Heading west-north-west with Makkah behind: the qibla is well behind the wings.
    expect(Math.abs(maghrib.relative)).toBeGreaterThan(100);
    for (let i = 1; i < events.length; i++) expect(events[i].at.getTime()).toBeGreaterThanOrEqual(events[i - 1].at.getTime());
  });
});
