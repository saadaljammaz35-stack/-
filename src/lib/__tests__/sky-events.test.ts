import { KAABA } from '../qibla';
import { crescentOn, kaabaTransits, upcomingEclipses } from '../sky-events';

const riyadh = { lat: 24.7136, lng: 46.6753 };

describe('the sun over the Kaaba', () => {
  it('finds the two transits over the Kaaba and the two over its antipode in a year', () => {
    const list = kaabaTransits(new Date('2024-01-01T00:00:00Z'), 366);
    const kaaba = list.filter((e) => e.kind === 'kaaba');
    const antipode = list.filter((e) => e.kind === 'antipode');
    expect(kaaba).toHaveLength(2);
    expect(antipode.length).toBeGreaterThanOrEqual(2);
    // Announced yearly: 27 May 12:18 and 15 July 12:27 Makkah time.
    expect(Math.abs(kaaba[0].at.getTime() - new Date('2024-05-27T09:18:00Z').getTime())).toBeLessThan(15 * 60_000);
    expect(Math.abs(kaaba[1].at.getTime() - new Date('2024-07-15T09:27:00Z').getTime())).toBeLessThan(15 * 60_000);
    for (const e of list) expect(e.altitude).toBeGreaterThan(89);
    // Over the antipode it is night in Makkah (Kaaba longitude + 180°): late November and mid-January.
    const months = antipode.map((e) => e.at.getUTCMonth());
    expect(months).toEqual(expect.arrayContaining([0, 10]));
    expect(KAABA.lat).toBeCloseTo(21.42, 2);
  });
});

describe('eclipses', () => {
  it('finds the total solar eclipse of 2 August 2027 over Makkah', () => {
    const list = upcomingEclipses(KAABA.lat, KAABA.lng, new Date('2027-01-01T00:00:00Z'), 1).filter((e) => e.body === 'sun');
    const aug = list.find((e) => e.peak.toISOString().startsWith('2027-08-02'))!;
    expect(aug).toBeDefined();
    expect(aug.magnitude).toBeGreaterThan(0.9);
    expect(aug.visibleAtPeak).toBe(true);
  });

  it('finds the total lunar eclipse of 7 September 2025 from Riyadh', () => {
    const list = upcomingEclipses(riyadh.lat, riyadh.lng, new Date('2025-09-01T00:00:00Z'), 0.1);
    const moon = list.find((e) => e.body === 'moon')!;
    expect(moon.kind).toBe('total');
    expect(moon.peak.toISOString().startsWith('2025-09-07')).toBe(true);
    expect(moon.visibleAtPeak).toBe(true);
  });
});

describe('the crescent', () => {
  // The new moon of Ramadan 1447 was on 17 February 2026 around 12:01 UTC.
  it('is not seen the evening of the conjunction and plainly seen the next evening', () => {
    const first = crescentOn(new Date('2026-02-17T09:00:00Z'), riyadh.lat, riyadh.lng)!;
    expect(['impossible', 'not-visible']).toContain(first.zone);
    const next = crescentOn(new Date('2026-02-18T09:00:00Z'), riyadh.lat, riyadh.lng)!;
    expect(next.ageHours).toBeGreaterThan(20);
    expect(next.lagMinutes).toBeGreaterThan(40);
    expect(['naked-eye', 'optical-maybe-eye']).toContain(next.zone);
  });
});
