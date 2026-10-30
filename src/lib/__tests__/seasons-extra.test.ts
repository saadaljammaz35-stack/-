import { toHijri } from '../hijri';
import { dawudPlan, fastForbidden, oddNightTonight, pureGold, shawwalDays, zakatDue } from '../seasons-extra';

// Ramadan 1448 falls in February–March 2027; the helpers read the app's own Hijri conversion.
const civ = (y: number, m: number, d: number) => ({ year: y, month: m, day: d });

describe('seasons', () => {
  it('finds the odd nights of the last ten', () => {
    const nights: number[] = [];
    for (let i = 0; i < 60; i++) {
      const d = new Date(Date.UTC(2027, 1, 1 + i));
      const n = oddNightTonight(civ(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
      if (n) nights.push(n);
    }
    expect(nights).toEqual([21, 23, 25, 27, 29]);
  });

  it('lists Shawwal from its second day', () => {
    const days = shawwalDays(civ(2027, 3, 1));
    expect(days.length).toBeGreaterThanOrEqual(28);
    expect(toHijri(days[0]).month).toBe(10);
    expect(toHijri(days[0]).day).toBe(2);
  });

  it('alternates for Dawud and never fasts on Eid', () => {
    const plan = dawudPlan(civ(2027, 3, 1), 40);
    const eid = plan.find((p) => toHijri(p.date).month === 10 && toHijri(p.date).day === 1)!;
    expect(eid.fast).toBe(false);
    expect(plan.filter((p) => fastForbidden(p.date)).every((p) => !p.fast)).toBe(true);
    const after = plan.filter((p) => toHijri(p.date).month === 10).slice(1, 7).map((p) => p.fast);
    expect(after).toEqual([true, false, true, false, true, false]);
  });
});

describe('zakat', () => {
  const base = { cash: 0, goldGrams: 0, silverGrams: 0, trade: 0, receivable: 0, debts: 0, goldPrice: 400, silverPrice: 5, basis: 'gold' as const };
  it('is a quarter of a tenth above the nisab', () => {
    expect(zakatDue({ ...base, cash: 40_000 })).toEqual({ wealth: 40_000, nisab: 34_000, due: 1000 });
    expect(zakatDue({ ...base, cash: 30_000 }).due).toBe(0);
    expect(zakatDue({ ...base, cash: 30_000, basis: 'silver' }).due).toBe(750);
    expect(zakatDue({ ...base, cash: 40_000, debts: 10_000 }).due).toBe(0);
  });
  it('converts carats to pure gold', () => {
    expect(pureGold(100, 21)).toBe(87.5);
    expect(pureGold(24, 18)).toBe(18);
  });
});
