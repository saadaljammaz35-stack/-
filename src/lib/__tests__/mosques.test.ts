import { bearingDeg, formatDistance, overpassQuery, parseMosques, roundCoord } from '../mosques';

const here = { lat: 24.7136, lng: 46.6753 };

describe('nearby mosques', () => {
  it('rounds the position it sends to about 100 m', () => {
    expect(roundCoord(24.71364)).toBe(24.714);
    const q = overpassQuery(24.71364, 46.67531, 3000);
    expect(q).toContain('around:3000,24.714,46.675');
    expect(q).not.toContain('24.7136');
    expect(q).toContain('"religion"="muslim"');
  });

  it('parses nodes and ways, prefers the Arabic name and sorts by distance', () => {
    const list = parseMosques(
      {
        elements: [
          { type: 'way', id: 2, center: { lat: 24.9, lon: 46.9 }, tags: { name: 'Far Mosque' } },
          { type: 'way', id: 4, tags: { name: 'No position' } },
          { type: 'way', id: 3, center: { lat: 24.725, lon: 46.6753 }, tags: { name: 'Al Noor', 'name:ar': 'مسجد النور' } },
          { type: 'node', id: 1, lat: 24.714, lon: 46.676, tags: {} },
          { type: 'node', id: 1, lat: 24.714, lon: 46.676, tags: {} },
        ],
      },
      here.lat,
      here.lng,
    );
    expect(list.map((m) => m.id)).toEqual(['node/1', 'way/3', 'way/2']);
    expect(list[0].name).toBeNull();
    expect(list[1].name).toBe('مسجد النور');
    expect(list[1].km).toBeCloseTo(1.26, 1);
  });

  it('gives the direction from north', () => {
    expect(bearingDeg(24, 46, 25, 46)).toBeCloseTo(0, 0);
    expect(bearingDeg(24, 46, 24, 47)).toBeCloseTo(90, 0);
    expect(bearingDeg(24, 46, 23, 46)).toBeCloseTo(180, 0);
  });

  it('reads distances in metres, then kilometres', () => {
    expect(formatDistance(0.347)).toBe('350 م');
    expect(formatDistance(0.004)).toBe('10 م');
    expect(formatDistance(1.234)).toBe('1.2 كم');
    expect(formatDistance(12.6, 'en')).toBe('13 km');
  });
});
