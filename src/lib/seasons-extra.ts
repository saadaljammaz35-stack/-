// Calendar helpers for the seasons: the odd nights of Ramadan's last ten, the six of Shawwal and a
// Dawud fasting plan (a day on, a day off), skipping the days on which fasting is not allowed.
import { addCivilDays, toHijri, type CivilDate } from './hijri';

/** Eid al-Fitr, Eid al-Adha and the three days of Tashreeq. */
export function fastForbidden(date: CivilDate, hijriOffset = 0): boolean {
  const h = toHijri(date, hijriOffset);
  return (h.month === 10 && h.day === 1) || (h.month === 12 && h.day >= 10 && h.day <= 13);
}

/** The odd night that begins on the evening of `date` (21, 23 … 29), or null. */
export function oddNightTonight(date: CivilDate, hijriOffset = 0): number | null {
  const tomorrow = toHijri(addCivilDays(date, 1), hijriOffset);
  return tomorrow.month === 9 && tomorrow.day >= 21 && tomorrow.day % 2 === 1 ? tomorrow.day : null;
}

/** The Shawwal days (from the 2nd) of the Hijri year that `date` falls in or before, as civil dates. */
export function shawwalDays(date: CivilDate, hijriOffset = 0): CivilDate[] {
  const out: CivilDate[] = [];
  // Search the next 400 days for Shawwal 2–29 (or 30).
  for (let i = -40; i < 400 && out.length < 29; i++) {
    const d = addCivilDays(date, i);
    const h = toHijri(d, hijriOffset);
    if (h.month === 10 && h.day >= 2) out.push(d);
    else if (out.length) break;
  }
  return out;
}

/**
 * Dawud's fast: a day fasted, a day not, starting `start`. A day on which fasting is not allowed is
 * skipped and the plan resumes on the next allowed day. Ramadan is fasted anyway and pauses it.
 */
export function dawudPlan(start: CivilDate, days: number, hijriOffset = 0): { date: CivilDate; fast: boolean }[] {
  const out: { date: CivilDate; fast: boolean }[] = [];
  let fastNext = true;
  for (let i = 0; i < days; i++) {
    const date = addCivilDays(start, i);
    const h = toHijri(date, hijriOffset);
    if (fastForbidden(date, hijriOffset) || h.month === 9) {
      out.push({ date, fast: false });
      fastNext = true;
      continue;
    }
    out.push({ date, fast: fastNext });
    fastNext = !fastNext;
  }
  return out;
}

// ---------- Zakat ----------

/** Contemporary estimates of the nisab: twenty mithqal of gold and two hundred dirhams of silver. */
export const NISAB_GOLD_G = 85;
export const NISAB_SILVER_G = 595;
export const ZAKAT_RATE = 0.025;

export type ZakatInput = {
  cash: number;
  /** Grams of pure (24 carat) gold equivalent. */
  goldGrams: number;
  silverGrams: number;
  trade: number;
  receivable: number;
  debts: number;
  goldPrice: number;
  silverPrice: number;
  basis: 'gold' | 'silver';
};

export function zakatDue(i: ZakatInput): { wealth: number; nisab: number; due: number } {
  const wealth = Math.max(0, i.cash + i.goldGrams * i.goldPrice + i.silverGrams * i.silverPrice + i.trade + i.receivable - i.debts);
  const nisab = i.basis === 'gold' ? NISAB_GOLD_G * i.goldPrice : NISAB_SILVER_G * i.silverPrice;
  const due = nisab > 0 && wealth >= nisab ? wealth * ZAKAT_RATE : 0;
  return { wealth, nisab, due };
}

/** Grams of pure gold in `grams` of a given carat. */
export const pureGold = (grams: number, carat: 24 | 22 | 21 | 18) => (grams * carat) / 24;
