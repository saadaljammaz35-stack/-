import { addCivilDays } from '../hijri';
import { createKhatma, effectiveSchedule, pace, recordReading, status, TOTAL_PAGES, type Khatma } from '../khatma';

const start = { year: 2026, month: 10, day: 1 };
const base = () => createKhatma({ id: 'k', name: 'ختمة', plan: { kind: 'days', days: 30 }, start, now: 0 });

describe('smart khatma plan', () => {
  it('without the smart plan, missed days pile up as a delay', () => {
    const k = base();
    const s = status(k, addCivilDays(start, 3)); // day 4, nothing read
    expect(s.delta).toBeLessThan(0);
    expect(s.today!.from).toBeGreaterThan(1);
  });

  it('spreads what is left over the days left, from where the reader is', () => {
    const k = { ...base(), adaptive: true };
    const today = addCivilDays(start, 3);
    const s = status(k, today);
    expect(s.delta).toBe(0);
    expect(s.daysLeft).toBe(27);
    expect(s.today!.from).toBe(1);
    // 604 pages over 27 days: 22 or 23 a day.
    expect(s.today!.to).toBe(23);
    const plan = effectiveSchedule(k, today);
    expect(plan[plan.length - 1].to).toBe(TOTAL_PAGES);
    expect(plan[plan.length - 1].date).toEqual(addCivilDays(start, 29));
  });

  it('keeps today’s portion fixed while reading it', () => {
    const today = addCivilDays(start, 3);
    let k: Khatma = { ...base(), adaptive: true };
    const before = status(k, today).today!;
    k = recordReading(k, 10, today);
    const during = status(k, today).today!;
    expect(during).toEqual(before);
    k = recordReading(k, before.to, today);
    expect(status(k, today).today!.to).toBe(k.progress);
    // Tomorrow starts from the new position.
    expect(status(k, addCivilDays(today, 1)).today!.from).toBe(before.to + 1);
  });

  it('past the planned end, continues at the plan’s rate', () => {
    const k = { ...base(), adaptive: true };
    const late = addCivilDays(start, 40);
    const s = status(k, late);
    expect(s.today!.to - s.today!.from + 1).toBeLessThanOrEqual(Math.ceil(TOTAL_PAGES / 30));
    // 604 pages at 21 a day: 29 days from today.
    expect(s.endsOn).toEqual(addCivilDays(late, 28));
  });

  it('measures the reader’s pace and projects the end', () => {
    let k = base();
    for (let d = 0; d < 7; d++) k = recordReading(k, (d + 1) * 10, addCivilDays(start, d));
    const today = addCivilDays(start, 6);
    const p = pace(k, today);
    expect(p.perDay).toBe(10);
    expect(p.finishOn).toEqual(addCivilDays(today, Math.ceil((TOTAL_PAGES - 70) / 10)));
    expect(pace(base(), start).finishOn).toBeNull();
  });
});
