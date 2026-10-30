import { bedtimes, habitStreak, lastSevenDays, relativeDue, relativesDue } from '../habits';

const d = (day: number) => ({ year: 2026, month: 10, day });

describe('habits', () => {
  it('counts a streak that tolerates today not yet ticked', () => {
    expect(habitStreak(['2026-10-28', '2026-10-29'], d(30))).toBe(2);
    expect(habitStreak(['2026-10-28', '2026-10-29', '2026-10-30'], d(30))).toBe(3);
    expect(habitStreak(['2026-10-27'], d(30))).toBe(0);
  });
  it('lays out the last seven days', () => {
    const w = lastSevenDays(['2026-10-30', '2026-10-24'], d(30));
    expect(w).toHaveLength(7);
    expect(w[0]).toEqual({ date: d(24), done: true });
    expect(w[6].done).toBe(true);
  });
});

describe('relatives', () => {
  const list = [
    { id: 'a', name: 'خالي', everyDays: 7, last: '2026-10-20' },
    { id: 'b', name: 'عمتي', everyDays: 30, last: '2026-10-25' },
    { id: 'c', name: 'جدتي', everyDays: 3, last: null },
  ];
  it('is due a fixed number of days after the last contact', () => {
    expect(relativeDue(list[0], d(30))).toBe('2026-10-27');
    expect(relativeDue(list[2], d(30))).toBe('2026-10-30');
  });
  it('lists those due, most overdue first', () => {
    expect(relativesDue(list, d(30)).map((r) => r.id)).toEqual(['a', 'c']);
  });
});

describe('sleep', () => {
  it('works back from waking in whole cycles', () => {
    const wake = new Date('2026-10-30T01:30:00Z');
    expect(bedtimes(wake).map((b) => b.at.toISOString().slice(11, 16))).toEqual(['16:15', '17:45', '19:15']);
  });
});
