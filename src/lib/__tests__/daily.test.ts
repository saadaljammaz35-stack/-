import { dailyItems, dailyProgress, type DailyInput } from '../daily';
import { createKhatma, recordReading } from '../khatma';

const today = { year: 2026, month: 11, day: 3 };
const base: DailyInput = { today, prayers: undefined, khatma: undefined, pagesToday: 0, morning: null, evening: null, hifz: {} };

describe('daily ring', () => {
  it('starts the day empty with prayers and Quran', () => {
    const items = dailyItems(base);
    expect(items.map((i) => i.id)).toEqual(['prayers', 'quran']);
    expect(dailyProgress(items)).toBe(0);
  });

  it('counts prayed (not missed) prayers and pages read', () => {
    const items = dailyItems({ ...base, prayers: { fajr: 'jamaah', dhuhr: 'late', asr: 'missed' }, pagesToday: 3 });
    expect(items[0]).toEqual({ id: 'prayers', done: 2, total: 5 });
    expect(items[1]).toEqual({ id: 'quran', done: 1, total: 1 });
    expect(dailyProgress(items)).toBeCloseTo((0.4 + 1) / 2);
  });

  it("uses the khatma's portion for today when one is active", () => {
    let k = createKhatma({ id: 'k', name: 'k', plan: { kind: 'pages', pagesPerDay: 10 }, start: { year: 2026, month: 11, day: 1 }, now: 0 });
    // Days 1–2 read (pages 1–20); today's portion is 21–30, five of them read.
    k = recordReading(k, 25, today);
    const quran = dailyItems({ ...base, khatma: k }).find((i) => i.id === 'quran');
    expect(quran).toEqual({ id: 'quran', done: 5, total: 10 });
  });

  it('adds adhkar lists once loaded and memorisation only on review days', () => {
    const hifz = {
      '1': { box: 2, due: '2026-11-03', reviews: 2, lapses: 0, since: '2026-11-01' },
      '2': { box: 2, due: '2026-11-06', reviews: 3, lapses: 0, since: '2026-11-01', last: '2026-11-03' },
      '3': { box: 3, due: '2026-11-20', reviews: 3, lapses: 0, since: '2026-10-01', last: '2026-10-30' },
    };
    const items = dailyItems({ ...base, morning: { done: 20, total: 20 }, evening: { done: 0, total: 22 }, hifz });
    expect(items.map((i) => i.id)).toEqual(['prayers', 'quran', 'morning', 'evening', 'hifz']);
    expect(items[4]).toEqual({ id: 'hifz', done: 1, total: 2 });
    expect(dailyItems({ ...base, hifz: { '3': hifz['3'] } }).some((i) => i.id === 'hifz')).toBe(false);
  });
});
