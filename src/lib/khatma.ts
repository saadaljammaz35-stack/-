// Khatma (completing the Quran) planning: splits the 604 pages into daily portions, tracks
// progress, pauses and resumes, and reports whether the reader is ahead or behind.
import { addCivilDays, daysBetween, parseCivilKey, civilKey, type CivilDate } from './hijri';

export const TOTAL_PAGES = 604;

export type KhatmaPlan =
  | { kind: 'days'; days: number }
  | { kind: 'pages'; pagesPerDay: number };

export type ReadingEntry = { date: string; from: number; to: number };

export type Khatma = {
  id: string;
  name: string;
  plan: KhatmaPlan;
  startDate: string; // YYYY-MM-DD in the user's zone
  /** Last page completed (0 when nothing read yet). */
  progress: number;
  log: ReadingEntry[];
  status: 'active' | 'paused' | 'completed';
  pausedOn: string | null;
  /** Total days spent paused; the schedule shifts by this amount. */
  pausedDays: number;
  completedOn: string | null;
  reminder: { enabled: boolean; hour: number; minute: number };
  createdAt: number;
  /** «الخطة الذكية»: each day, spread the pages left evenly over the days left. */
  adaptive?: boolean;
};

export type DayPortion = { day: number; date: CivilDate; from: number; to: number };

export function totalDays(plan: KhatmaPlan): number {
  return plan.kind === 'days'
    ? Math.max(1, Math.round(plan.days))
    : Math.ceil(TOTAL_PAGES / Math.max(1, Math.round(plan.pagesPerDay)));
}

/** Splits pages 1..604 into contiguous daily portions as evenly as possible. */
export function schedule(k: Pick<Khatma, 'plan' | 'startDate' | 'pausedDays'>): DayPortion[] {
  const days = totalDays(k.plan);
  const start = addCivilDays(parseCivilKey(k.startDate), k.pausedDays);
  const out: DayPortion[] = [];
  if (k.plan.kind === 'pages') {
    const per = Math.max(1, Math.round(k.plan.pagesPerDay));
    for (let i = 0; i < days; i++) {
      const from = i * per + 1;
      out.push({ day: i + 1, date: addCivilDays(start, i), from, to: Math.min(TOTAL_PAGES, from + per - 1) });
    }
    return out;
  }
  const base = Math.floor(TOTAL_PAGES / days);
  const extra = TOTAL_PAGES % days;
  let page = 1;
  for (let i = 0; i < days; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push({ day: i + 1, date: addCivilDays(start, i), from: page, to: page + size - 1 });
    page += size;
  }
  return out;
}

/** Pages recorded on a given day. */
function pagesOn(k: Khatma, key: string): number {
  return k.log.reduce((n, e) => (e.date === key ? n + e.to - e.from + 1 : n), 0);
}

/**
 * The schedule as it stands today. With the smart plan, the pages left at the start of today
 * are spread evenly over the days left, so a missed day is absorbed instead of piling up.
 */
export function effectiveSchedule(k: Khatma, today: CivilDate): DayPortion[] {
  const base = schedule(k);
  if (!k.adaptive || k.status !== 'active') return base;
  const dayIndex = daysBetween(base[0].date, today) + 1;
  if (dayIndex < 1) return base;
  const startProgress = k.progress - pagesOn(k, civilKey(today));
  const left = TOTAL_PAGES - startProgress;
  // Past the planned end, carry on at the plan's own daily rate rather than all at once.
  const days = dayIndex <= base.length ? base.length - dayIndex + 1 : Math.max(1, Math.ceil(left / Math.ceil(TOTAL_PAGES / base.length)));
  const out = base.filter((d) => d.day < dayIndex);
  const per = Math.floor(left / days);
  const extra = left % days;
  let page = startProgress + 1;
  for (let i = 0; i < days; i++) {
    const size = per + (i < extra ? 1 : 0);
    if (size <= 0) continue;
    out.push({ day: dayIndex + i, date: addCivilDays(today, i), from: page, to: page + size - 1 });
    page += size;
  }
  return out;
}

export type Pace = {
  /** Average pages a day over the recent days (or since the start, if sooner). */
  perDay: number;
  /** When the khatma ends at that pace, or null without recent reading. */
  finishOn: CivilDate | null;
};

/** The reader's actual pace over the last `window` days, including today. */
export function pace(k: Khatma, today: CivilDate, window = 7): Pace {
  const since = Math.max(1, Math.min(window, daysBetween(parseCivilKey(k.startDate), today) + 1));
  const from = civilKey(addCivilDays(today, -(since - 1)));
  const to = civilKey(today);
  const pages = k.log.reduce((n, e) => (e.date >= from && e.date <= to ? n + e.to - e.from + 1 : n), 0);
  const perDay = pages / since;
  const left = TOTAL_PAGES - k.progress;
  return { perDay: Math.round(perDay * 10) / 10, finishOn: left === 0 ? today : perDay > 0 ? addCivilDays(today, Math.ceil(left / perDay)) : null };
}

export type KhatmaStatus = {
  percent: number;
  pagesLeft: number;
  dayIndex: number; // 1-based day of the plan for `today` (may exceed the plan length)
  daysLeft: number;
  today: DayPortion | null;
  expectedProgress: number; // last page that should be done by the end of today
  /**
   * Negative: pages behind what should have been read before today. Positive: pages read
   * beyond today's portion. Zero: on track (today's portion may still be pending).
   */
  delta: number;
  endsOn: CivilDate;
};

export function status(k: Khatma, todayDate: CivilDate): KhatmaStatus {
  const plan = effectiveSchedule(k, todayDate);
  const last = plan[plan.length - 1];
  const effectiveToday =
    k.status === 'paused' && k.pausedOn ? parseCivilKey(k.pausedOn) : todayDate;
  const dayIndex = daysBetween(plan[0].date, effectiveToday) + 1;
  const today = plan.find((p) => p.day === dayIndex) ?? null;
  // Pages that should be read by the end of today, and by the end of yesterday. Today's
  // portion only counts as overdue once the day has passed.
  const expectedProgress = dayIndex < 1 ? 0 : dayIndex > last.day ? TOTAL_PAGES : (today?.to ?? TOTAL_PAGES);
  // The smart plan has already spread anything missed over the days left.
  const smart = k.adaptive && k.status === 'active';
  const dueBeforeToday = dayIndex <= 1 || smart ? 0 : dayIndex - 1 > last.day ? TOTAL_PAGES : (plan.find((p) => p.day === dayIndex - 1)?.to ?? 0);
  return {
    percent: Math.round((k.progress / TOTAL_PAGES) * 1000) / 10,
    pagesLeft: TOTAL_PAGES - k.progress,
    dayIndex,
    // Days remaining including today.
    daysLeft: dayIndex < 1 ? last.day : Math.max(0, last.day - dayIndex + 1),
    today,
    expectedProgress,
    delta: k.progress < dueBeforeToday ? k.progress - dueBeforeToday : Math.max(0, k.progress - expectedProgress),
    endsOn: last.date,
  };
}

export function createKhatma(input: {
  id: string;
  name: string;
  plan: KhatmaPlan;
  start: CivilDate;
  reminder?: Khatma['reminder'];
  now: number;
}): Khatma {
  return {
    id: input.id,
    name: input.name,
    plan: input.plan,
    startDate: civilKey(input.start),
    progress: 0,
    log: [],
    status: 'active',
    pausedOn: null,
    pausedDays: 0,
    completedOn: null,
    reminder: input.reminder ?? { enabled: true, hour: 20, minute: 0 },
    createdAt: input.now,
  };
}

/** Records reading up to `page` (inclusive). Pages already counted are ignored. */
export function recordReading(k: Khatma, page: number, today: CivilDate): Khatma {
  const target = Math.min(TOTAL_PAGES, Math.max(0, Math.floor(page)));
  if (target <= k.progress || k.status === 'completed') return k;
  const entry = { date: civilKey(today), from: k.progress + 1, to: target };
  const done = target === TOTAL_PAGES;
  return {
    ...k,
    progress: target,
    log: [...k.log, entry],
    status: done ? 'completed' : k.status,
    completedOn: done ? civilKey(today) : null,
  };
}

export function pause(k: Khatma, today: CivilDate): Khatma {
  if (k.status !== 'active') return k;
  return { ...k, status: 'paused', pausedOn: civilKey(today) };
}

export function resume(k: Khatma, today: CivilDate): Khatma {
  if (k.status !== 'paused' || !k.pausedOn) return k;
  const paused = Math.max(0, daysBetween(parseCivilKey(k.pausedOn), today));
  return { ...k, status: 'active', pausedOn: null, pausedDays: k.pausedDays + paused };
}

export const PRESET_DAYS = [7, 10, 15, 30, 60];
