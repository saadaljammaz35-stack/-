// «حصادي»: what the user did over a week, a month or a Hijri month (in Ramadan, «حصاد رمضان»),
// summed from the local logs into a shareable card.
import { addCivilDays, civilKey, daysBetween, toGregorian, toHijri, type CivilDate } from './hijri';
import type { HifzCard } from './hifz';
import type { Khatma } from './khatma';
import { FARD_IDS, isCompleteDay, type DayLog } from './prayer-log';

export type HarvestKind = 'week' | 'month' | 'hijri';
export type HarvestPeriod = { kind: HarvestKind; from: CivilDate; to: CivilDate; days: number; hijriMonth?: number };

export function harvestPeriod(kind: HarvestKind, today: CivilDate, hijriOffset = 0): HarvestPeriod {
  if (kind === 'hijri') {
    const h = toHijri(today, hijriOffset);
    const from = toGregorian({ year: h.year, month: h.month, day: 1 }, hijriOffset);
    return { kind, from, to: today, days: daysBetween(from, today) + 1, hijriMonth: h.month };
  }
  const days = kind === 'week' ? 7 : 30;
  return { kind, from: addCivilDays(today, -(days - 1)), to: today, days };
}

export function periodKeys(p: HarvestPeriod): string[] {
  return Array.from({ length: p.days }, (_, i) => civilKey(addCivilDays(p.from, i)));
}

export type ListItems = { key: string; repeat: number }[];

/** Days on which every item of an adhkar list reached its count. */
export function completeListDays(progress: Record<string, Record<string, number>>, listId: string, items: ListItems, keys: string[]): string[] {
  if (!items.length) return [];
  return keys.filter((k) => items.every((i) => (progress[k]?.[`${listId}|${i.key}`] ?? 0) >= i.repeat));
}

export type HarvestInput = {
  period: HarvestPeriod;
  pagesRead: Record<string, number[]>;
  prayers: Record<string, DayLog>;
  morningDays: string[];
  eveningDays: string[];
  tasbih: Record<string, number>;
  fasting: Record<string, string>;
  hifz: Record<string, HifzCard>;
  khatmas: Khatma[];
};

export type Harvest = {
  pages: number;
  prayed: number;
  jamaah: number;
  completeDays: number;
  morning: number;
  evening: number;
  tasbih: number;
  fasted: number;
  versesLearned: number;
  khatmasCompleted: number;
  /** Per day, 0–3: all five prayers, some Quran, the morning or evening adhkar. */
  levels: number[];
};

export function harvest(i: HarvestInput): Harvest {
  const keys = periodKeys(i.period);
  const inPeriod = (k: string | null | undefined) => Boolean(k) && k! >= keys[0] && k! <= keys[keys.length - 1];
  const sum = (f: (k: string) => number) => keys.reduce((n, k) => n + f(k), 0);
  const adhkarDays = new Set([...i.morningDays, ...i.eveningDays]);
  return {
    pages: sum((k) => i.pagesRead[k]?.length ?? 0),
    prayed: sum((k) => FARD_IDS.filter((id) => i.prayers[k]?.[id] && i.prayers[k][id] !== 'missed').length),
    jamaah: sum((k) => FARD_IDS.filter((id) => i.prayers[k]?.[id] === 'jamaah').length),
    completeDays: keys.filter((k) => isCompleteDay(i.prayers[k])).length,
    morning: i.morningDays.filter(inPeriod).length,
    evening: i.eveningDays.filter(inPeriod).length,
    tasbih: sum((k) => i.tasbih[k] ?? 0),
    fasted: keys.filter((k) => i.fasting[k] === 'fasted').length,
    versesLearned: Object.values(i.hifz).filter((c) => inPeriod(c.since) && c.box >= 1).length,
    khatmasCompleted: i.khatmas.filter((k) => inPeriod(k.completedOn)).length,
    levels: keys.map((k) => (isCompleteDay(i.prayers[k]) ? 1 : 0) + ((i.pagesRead[k]?.length ?? 0) > 0 ? 1 : 0) + (adhkarDays.has(k) ? 1 : 0)),
  };
}
