import { completeListDays, harvest, harvestPeriod, periodKeys, type HarvestInput } from '../harvest';
import { toHijri } from '../hijri';

const today = { year: 2026, month: 10, day: 26 };

describe('harvest', () => {
  it('builds week, month and Hijri-month periods ending today', () => {
    const week = harvestPeriod('week', today);
    expect(periodKeys(week)).toHaveLength(7);
    expect(periodKeys(week)[0]).toBe('2026-10-20');
    expect(harvestPeriod('month', today).days).toBe(30);
    const h = harvestPeriod('hijri', today);
    expect(toHijri(h.from)).toMatchObject({ day: 1, month: toHijri(today).month });
    expect(h.hijriMonth).toBe(toHijri(today).month);
  });

  it('finds the days an adhkar list was completed', () => {
    const progress = { '2026-10-25': { 'morning|me:1': 1, 'morning|me:2': 3 }, '2026-10-26': { 'morning|me:1': 1, 'morning|me:2': 1 } };
    const items = [{ key: 'me:1', repeat: 1 }, { key: 'me:2', repeat: 3 }];
    expect(completeListDays(progress, 'morning', items, ['2026-10-25', '2026-10-26'])).toEqual(['2026-10-25']);
    expect(completeListDays(progress, 'evening', items, ['2026-10-25'])).toEqual([]);
  });

  it('sums the logs inside the period only', () => {
    const input: HarvestInput = {
      period: harvestPeriod('week', today),
      pagesRead: { '2026-10-26': [1, 2, 3], '2026-10-19': [9] },
      prayers: {
        '2026-10-25': { fajr: 'jamaah', dhuhr: 'jamaah', asr: 'ontime', maghrib: 'late', isha: 'ontime' },
        '2026-10-26': { fajr: 'missed', dhuhr: 'jamaah' },
      },
      morningDays: ['2026-10-25', '2026-10-01'],
      eveningDays: ['2026-10-26'],
      tasbih: { '2026-10-24': 100, '2026-10-26': 33, '2026-09-01': 1000 },
      fasting: { '2026-10-22': 'fasted', '2026-10-23': 'excused' },
      hifz: {
        '1': { box: 1, due: '2026-10-27', reviews: 1, lapses: 0, since: '2026-10-26' },
        '2': { box: 0, due: '2026-10-27', reviews: 1, lapses: 0, since: '2026-10-26' },
        '3': { box: 3, due: '2026-11-01', reviews: 4, lapses: 0, since: '2026-09-01' },
      },
      khatmas: [],
    };
    const h = harvest(input);
    expect(h).toMatchObject({ pages: 3, prayed: 6, jamaah: 3, completeDays: 1, morning: 1, evening: 1, tasbih: 133, fasted: 1, versesLearned: 1, khatmasCompleted: 0 });
    expect(h.levels).toEqual([0, 0, 0, 0, 0, 2, 2]);
  });
});
