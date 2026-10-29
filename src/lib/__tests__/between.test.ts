import { betweenState, contiguousRuns, DEFAULT_IQAMA, prayerPortions } from '../between';
import { hifzStrength, type HifzCard } from '../hifz';

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 28, h, m));

describe('between the adhan and the iqama', () => {
  const previous = { id: 'maghrib' as const, at: at(14, 17) };
  const next = { id: 'isha' as const, at: at(15, 47) };

  it('is between from the adhan until the iqama', () => {
    const s = betweenState(at(14, 20), previous, next, DEFAULT_IQAMA);
    expect(s).toMatchObject({ phase: 'between', prayer: 'maghrib' });
    expect(s.iqamaAt.getTime()).toBe(at(14, 27).getTime());
  });

  it('waits for the next prayer after the iqama', () => {
    const s = betweenState(at(14, 30), previous, next, DEFAULT_IQAMA);
    expect(s).toMatchObject({ phase: 'waiting', prayer: 'isha' });
    expect(s.iqamaAt.getTime()).toBe(at(16, 7).getTime());
  });
});

describe('memorised verses in prayer', () => {
  it('groups consecutive verses', () => {
    expect(contiguousRuns([8, 3, 4, 5, 9, 20, 4])).toEqual([
      [3, 5],
      [8, 9],
      [20, 20],
    ]);
  });

  it('suggests two portions, longer at Fajr', () => {
    const ids = [...Array.from({ length: 30 }, (_, i) => 100 + i), 300, 301];
    expect(prayerPortions(ids, 'maghrib')).toEqual([
      [100, 107],
      [300, 301],
    ]);
    expect(prayerPortions(ids, 'fajr')[0]).toEqual([100, 114]);
    expect(prayerPortions([], 'isha')).toEqual([]);
  });

  it('rates how firmly a verse is held', () => {
    const today = { year: 2026, month: 10, day: 28 };
    const card = (box: number, due: string): HifzCard => ({ box, due, reviews: 3, lapses: 0, since: '2026-10-01' });
    expect(hifzStrength(card(5, '2026-10-28'), today)).toBe('due');
    expect(hifzStrength(card(5, '2026-11-20'), today)).toBe('strong');
    expect(hifzStrength(card(2, '2026-11-02'), today)).toBe('growing');
    expect(hifzStrength(card(1, '2026-10-29'), today)).toBe('weak');
  });
});
