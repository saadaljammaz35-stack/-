import { forbiddenNow, prayerWindows } from '../prayer-windows';

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 30, h, m));
const times = { fajr: at(1, 50), sunrise: at(3, 8), dhuhr: at(8, 52), asr: at(12, 2), maghrib: at(14, 36) };

describe('forbidden times and duha', () => {
  const w = prayerWindows(times);

  it('places the four forbidden windows', () => {
    expect(w.forbidden.map((x) => [x.id, x.from.toISOString().slice(11, 16), x.to.toISOString().slice(11, 16)])).toEqual([
      ['after-fajr', '01:50', '03:08'],
      ['sunrise', '03:08', '03:23'],
      ['zenith', '08:42', '08:52'],
      ['after-asr', '12:02', '14:36'],
    ]);
  });

  it('duha runs from the sun risen to before the zenith', () => {
    expect([w.duha.from.toISOString().slice(11, 16), w.duha.to.toISOString().slice(11, 16)]).toEqual(['03:23', '08:42']);
  });

  it('finds the window now', () => {
    expect(forbiddenNow(at(3, 10), w.forbidden)?.id).toBe('sunrise');
    expect(forbiddenNow(at(8, 45), w.forbidden)?.id).toBe('zenith');
    expect(forbiddenNow(at(5, 0), w.forbidden)).toBeNull();
    expect(forbiddenNow(at(8, 52), w.forbidden)).toBeNull();
  });
});
