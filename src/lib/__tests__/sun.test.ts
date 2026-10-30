import { computeDay, DEFAULT_PRAYER_SETTINGS, type PlaceLocation } from '../prayer-times';
import { KAABA, qiblaBearing } from '../qibla';
import { lowestSunAltitude, MAX_READABLE_ALTITUDE, nextReadableSun, solarCoordinates, sunPosition, sunQibla } from '../sun';

const riyadh: PlaceLocation = { name: 'الرياض', lat: 24.7136, lng: 46.6753, timezone: 'Asia/Riyadh', source: 'manual' };

describe('sun position', () => {
  it('stands over the Kaaba at the known transits of late May and mid-July', () => {
    // Announced yearly: 27 May 12:18 and 15 July 12:27 Makkah time (UTC+3).
    expect(sunPosition(new Date('2024-05-27T09:18:00Z'), KAABA.lat, KAABA.lng).altitude).toBeGreaterThan(89.5);
    expect(sunPosition(new Date('2024-07-15T09:27:00Z'), KAABA.lat, KAABA.lng).altitude).toBeGreaterThan(89.5);
  });

  it('has the solstice declination and a small equation of time', () => {
    const june = solarCoordinates(new Date('2025-06-21T03:00:00Z'));
    expect(june.declination).toBeCloseTo(23.44, 1);
    // Early November: the sun runs about 16 minutes fast.
    expect(solarCoordinates(new Date('2025-11-03T12:00:00Z')).equationOfTime).toBeCloseTo(16.4, 0);
  });

  it('rises in the east at sunrise and stands due south at Dhuhr in Riyadh', () => {
    const day = computeDay({ year: 2025, month: 3, day: 20 }, riyadh, DEFAULT_PRAYER_SETTINGS);
    const rise = sunPosition(day.times.sunrise, riyadh.lat, riyadh.lng);
    // Sunrise is when the upper limb clears the horizon after refraction: the centre is at about −0.83°.
    expect(rise.altitude).toBeGreaterThan(-1.3);
    expect(rise.altitude).toBeLessThan(-0.4);
    expect(Math.abs(rise.azimuth - 90)).toBeLessThan(2);
    // adhan's Dhuhr is a minute or so after the transit.
    const noon = sunPosition(new Date(day.times.dhuhr.getTime() - 60_000), riyadh.lat, riyadh.lng);
    expect(Math.abs(noon.azimuth - 180)).toBeLessThan(3);
    expect(noon.altitude).toBeCloseTo(90 - riyadh.lat, 0);
  });
});

describe('qibla from the sun', () => {
  const q = qiblaBearing(riyadh.lat, riyadh.lng);

  it('says how far to turn from the sun', () => {
    const at = new Date('2025-03-20T05:00:00Z'); // 8 am in Riyadh, sun in the east
    const s = sunQibla(at, riyadh.lat, riyadh.lng, q);
    expect(s.kind).toBe('turn');
    if (s.kind !== 'turn') return;
    expect(s.azimuth).toBeGreaterThan(80);
    expect(s.azimuth).toBeLessThan(110);
    // Qibla from Riyadh is west by a little south (≈244°): from the eastern sun, nearly a half turn.
    expect(Math.abs(s.turn)).toBeGreaterThan(130);
    expect(((s.azimuth + s.turn) % 360 + 360) % 360).toBeCloseTo(q, 6);
  });

  it('gives no direction at night or with the sun overhead', () => {
    expect(sunQibla(new Date('2025-03-20T20:00:00Z'), riyadh.lat, riyadh.lng, q).kind).toBe('below');
    expect(sunQibla(new Date('2024-05-27T09:18:00Z'), KAABA.lat, KAABA.lng + 0.5, 270).kind).toBe('overhead');
  });

  it('finds when the sun can next be used', () => {
    const night = new Date('2025-03-20T20:00:00Z');
    const next = nextReadableSun(night, riyadh.lat, riyadh.lng)!;
    const day = computeDay({ year: 2025, month: 3, day: 21 }, riyadh, DEFAULT_PRAYER_SETTINGS);
    expect(Math.abs(next.getTime() - day.times.sunrise.getTime())).toBeLessThan(20 * 60_000);
    const noon = new Date('2024-05-27T09:18:00Z');
    const after = nextReadableSun(noon, KAABA.lat, KAABA.lng)!;
    expect(sunPosition(after, KAABA.lat, KAABA.lng).altitude).toBeLessThanOrEqual(MAX_READABLE_ALTITUDE);
    expect(after.getTime() - noon.getTime()).toBeLessThan(2 * 3600_000);
  });
});

describe('lowest sun at night', () => {
  it('never reaches 18° below in a London midsummer, does in Riyadh', () => {
    const june = new Date(Date.UTC(2026, 5, 21, 0));
    expect(lowestSunAltitude(june, 51.5)).toBeGreaterThan(-18);
    expect(lowestSunAltitude(june, 51.5)).toBeCloseTo(-15.1, 0);
    expect(lowestSunAltitude(june, 24.7)).toBeLessThan(-40);
    expect(lowestSunAltitude(new Date(Date.UTC(2026, 11, 21)), 51.5)).toBeCloseTo(-61.9, 0);
  });
});
