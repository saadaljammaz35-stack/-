// «يومي»: one ring for the day's essentials — the five prayers, the Quran portion, the morning
// and evening adhkar and any memorisation review — each contributing its share.
import { status as khatmaStatus, type Khatma } from './khatma';
import { civilKey, type CivilDate } from './hijri';
import { dueVerses, type HifzCard } from './hifz';
import { FARD_IDS, type DayLog } from './prayer-log';

export type DailyItemId = 'prayers' | 'quran' | 'morning' | 'evening' | 'hifz';
export type DailyItem = { id: DailyItemId; done: number; total: number };

/** Pages to read on a day without an active khatma. */
export const QURAN_GOAL_PAGES = 1;

export type DailyInput = {
  today: CivilDate;
  prayers: DayLog | undefined;
  khatma: Khatma | undefined;
  pagesToday: number;
  /** Completed / counted items of each list, or null while the list is loading. */
  morning: { done: number; total: number } | null;
  evening: { done: number; total: number } | null;
  hifz: Record<string, HifzCard>;
};

export function dailyItems(i: DailyInput): DailyItem[] {
  const items: DailyItem[] = [];
  items.push({ id: 'prayers', done: FARD_IDS.filter((id) => i.prayers?.[id] && i.prayers[id] !== 'missed').length, total: 5 });

  const portion = i.khatma?.status === 'active' ? khatmaStatus(i.khatma, i.today).today : null;
  if (i.khatma && portion) {
    const total = portion.to - portion.from + 1;
    items.push({ id: 'quran', done: Math.max(0, Math.min(total, i.khatma.progress - portion.from + 1)), total });
  } else {
    items.push({ id: 'quran', done: Math.min(QURAN_GOAL_PAGES, i.pagesToday), total: QURAN_GOAL_PAGES });
  }

  if (i.morning?.total) items.push({ id: 'morning', ...i.morning });
  if (i.evening?.total) items.push({ id: 'evening', ...i.evening });

  // Memorisation counts only on days with something to review.
  const key = civilKey(i.today);
  const reviewed = Object.values(i.hifz).filter((c) => c.last === key).length;
  const due = dueVerses(i.hifz, i.today).length;
  if (reviewed + due > 0) items.push({ id: 'hifz', done: reviewed, total: reviewed + due });
  return items;
}

/** 0–1: the average completion of the day's items. */
export function dailyProgress(items: DailyItem[]): number {
  if (!items.length) return 0;
  return items.reduce((sum, it) => sum + Math.min(1, it.done / it.total), 0) / items.length;
}
