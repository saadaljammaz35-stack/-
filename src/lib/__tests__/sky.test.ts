import { computeDay, DEFAULT_PRAYER_SETTINGS, type PlaceLocation } from '../prayer-times';
import { arcPoint, luminance, mixColor, skyAt, type SkyTimes } from '../sky';

const riyadh: PlaceLocation = { name: 'الرياض', lat: 24.7136, lng: 46.6753, timezone: 'Asia/Riyadh', source: 'manual' };
const day = computeDay({ year: 2026, month: 10, day: 26 }, riyadh, DEFAULT_PRAYER_SETTINGS);
const t: SkyTimes = {
  fajr: day.times.fajr.getTime(),
  sunrise: day.times.sunrise.getTime(),
  dhuhr: day.times.dhuhr.getTime(),
  asr: day.times.asr.getTime(),
  maghrib: day.times.maghrib.getTime(),
  isha: day.times.isha.getTime(),
};
const MIN = 60_000;

describe('living sky', () => {
  it('is a bright day sky with the sun mid-arc at Dhuhr', () => {
    const s = skyAt(t.dhuhr, t);
    expect(s.body.kind).toBe('sun');
    expect(s.body.progress).toBeGreaterThan(0.4);
    expect(s.body.progress).toBeLessThan(0.6);
    expect(s.stars).toBe(0);
    expect(luminance(s.bottom)).toBeGreaterThan(0.5);
  });

  it('shows stars and the moon late at night', () => {
    const s = skyAt(t.isha + 3 * 60 * MIN, t);
    expect(s.stars).toBe(1);
    expect(s.body.kind).toBe('moon');
    expect(luminance(s.top)).toBeLessThan(0.02);
    const early = skyAt(t.fajr - 2 * 60 * MIN, t);
    expect(early.body.kind).toBe('moon');
    expect(early.body.progress).toBeGreaterThan(0.6);
  });

  it('turns red-orange at Maghrib and fades the stars in by Isha', () => {
    const s = skyAt(t.maghrib, t);
    const [r, , b] = [parseInt(s.bottom.slice(1, 3), 16), 0, parseInt(s.bottom.slice(5, 7), 16)];
    expect(r).toBeGreaterThan(b);
    expect(skyAt(t.maghrib + 5 * MIN, t).stars).toBe(0);
    expect(skyAt(t.isha, t).stars).toBeCloseTo(1, 5);
  });

  it('changes smoothly from minute to minute', () => {
    for (let at = t.fajr - 90 * MIN; at < t.isha + 120 * MIN; at += 10 * MIN) {
      const a = skyAt(at, t);
      const b = skyAt(at + MIN, t);
      const jump = Math.abs(luminance(a.top) - luminance(b.top));
      expect(jump).toBeLessThan(0.03);
    }
  });

  it('mixes colours and places points on the arc', () => {
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(arcPoint(0, 200, 100).x).toBeCloseTo(14);
    expect(arcPoint(0.5, 200, 100)).toEqual({ x: 100, y: 14 });
    expect(arcPoint(1, 200, 100).x).toBeCloseTo(186);
  });
});
