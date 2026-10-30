import { parseCivilKey } from '../hijri';
import { createKhatma, pause, recordReading, resume, schedule, status, TOTAL_PAGES } from '../khatma';
import { DEFAULT_NOTIFICATION_SETTINGS, planNotifications } from '../notification-plan';
import { DEFAULT_PRAYER_SETTINGS, type PlaceLocation } from '../prayer-times';
import { instantAt } from '../time';

const riyadh: PlaceLocation = { name: 'الرياض', lat: 24.7136, lng: 46.6753, timezone: 'Asia/Riyadh', source: 'manual' };
const start = { year: 2026, month: 10, day: 1 };

describe('khatma planner', () => {
  it.each([7, 10, 15, 30, 60, 23])('splits 604 pages into %i contiguous days', (days) => {
    const plan = schedule({ plan: { kind: 'days', days }, startDate: '2026-10-01', pausedDays: 0 });
    expect(plan).toHaveLength(days);
    expect(plan[0].from).toBe(1);
    expect(plan[plan.length - 1].to).toBe(TOTAL_PAGES);
    for (let i = 1; i < plan.length; i++) expect(plan[i].from).toBe(plan[i - 1].to + 1);
    const sizes = plan.map((p) => p.to - p.from + 1);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it('is on track on the first day before reading', () => {
    const k = createKhatma({ id: 'n', name: 'ختمة', plan: { kind: 'days', days: 30 }, start, now: 0 });
    expect(status(k, start).delta).toBe(0);
    expect(status(recordReading(k, 30, start), start).delta).toBe(30 - schedule(k)[0].to);
  });

  it('plans by pages per day', () => {
    const plan = schedule({ plan: { kind: 'pages', pagesPerDay: 20 }, startDate: '2026-10-01', pausedDays: 0 });
    expect(plan).toHaveLength(31);
    expect(plan[30]).toMatchObject({ from: 601, to: 604 });
  });

  it('tracks progress, delay and completion', () => {
    let k = createKhatma({ id: 'a', name: 'ختمة', plan: { kind: 'days', days: 30 }, start, now: 0 });
    const day5 = { year: 2026, month: 10, day: 5 };
    k = recordReading(k, 60, day5);
    const s = status(k, day5);
    expect(s.dayIndex).toBe(5);
    expect(s.expectedProgress).toBe(schedule(k)[4].to);
    // Behind by what days 1–4 required; today's portion is not overdue yet.
    expect(s.delta).toBe(60 - schedule(k)[3].to);
    expect(s.daysLeft).toBe(26);
    expect(s.percent).toBeCloseTo(9.9, 1);
    expect(recordReading(k, 30, day5)).toBe(k); // going backwards is ignored
    k = recordReading(k, 604, { year: 2026, month: 10, day: 29 });
    expect(k.status).toBe('completed');
    expect(k.completedOn).toBe('2026-10-29');
    expect(k.log).toHaveLength(2);
  });

  it('shifts the schedule by the paused days', () => {
    let k = createKhatma({ id: 'b', name: 'ختمة', plan: { kind: 'days', days: 10 }, start, now: 0 });
    k = pause(k, { year: 2026, month: 10, day: 3 });
    expect(status(k, { year: 2026, month: 10, day: 9 }).dayIndex).toBe(3);
    k = resume(k, { year: 2026, month: 10, day: 8 });
    expect(k.pausedDays).toBe(5);
    expect(schedule(k)[0].date).toEqual(parseCivilKey('2026-10-06'));
    expect(status(k, { year: 2026, month: 10, day: 8 }).dayIndex).toBe(3);
  });
});

describe('notification planner', () => {
  const now = instantAt({ year: 2026, month: 10, day: 24 }, 13, 29, 'Asia/Riyadh');

  it('stays under the iOS pending limit, in order, with unique ids', () => {
    const plan = planNotifications({ now, place: riyadh, prayer: DEFAULT_PRAYER_SETTINGS, settings: DEFAULT_NOTIFICATION_SETTINGS });
    expect(plan.length).toBeLessThanOrEqual(60);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
    for (let i = 1; i < plan.length; i++) expect(plan[i].at.getTime()).toBeGreaterThanOrEqual(plan[i - 1].at.getTime());
    expect(plan.every((p) => p.at > now)).toBe(true);
  });

  it('starts with the pre-adhan reminder and the Asr adhan', () => {
    const plan = planNotifications({ now, place: riyadh, prayer: DEFAULT_PRAYER_SETTINGS, settings: DEFAULT_NOTIFICATION_SETTINGS });
    expect(plan[0]).toMatchObject({ id: 'pre-asr-2026-10-24', title: 'بقي 5 دقائق على أذان العصر' });
    expect(plan[1]).toMatchObject({ id: 'adhan-asr-2026-10-24', channel: 'adhan', sound: 'adhan' });
  });

  it('drops reminders before the adhan when the window is full', () => {
    const all = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      sleepAdhkar: { enabled: true, at: { hour: 22, minute: 0 } },
      quranReminder: { enabled: true, at: { hour: 20, minute: 0 } },
      fasting: { enabled: true, at: { hour: 21, minute: 0 } },
    };
    const plan = planNotifications({ now, place: riyadh, prayer: DEFAULT_PRAYER_SETTINGS, settings: all, days: 10 });
    expect(plan.length).toBeLessThanOrEqual(60);
    const lastFull = plan.filter((p) => p.priority !== 0).pop()!;
    const tail = plan.filter((p) => p.at > lastFull.at);
    expect(tail.every((p) => p.priority === 0)).toBe(true);
  });

  it('respects muted prayers and adds Friday and khatma reminders', () => {
    const settings = {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      prayers: { ...DEFAULT_NOTIFICATION_SETTINGS.prayers, fajr: { enabled: false, sound: 'default' as const } },
    };
    // Thursday afternoon, so Friday falls inside the rolling window.
    const thursday = instantAt({ year: 2026, month: 10, day: 29 }, 13, 0, 'Asia/Riyadh');
    const plan = planNotifications({
      now: thursday,
      place: riyadh,
      prayer: DEFAULT_PRAYER_SETTINGS,
      settings,
      khatmas: [{ id: 'k', name: 'الختمة', at: { hour: 20, minute: 0 }, portion: () => ({ from: 21, to: 40 }) }],
    });
    expect(plan.some((p) => p.id.startsWith('adhan-fajr'))).toBe(false);
    expect(plan.find((p) => p.id === 'kahf-2026-10-30')?.body).toContain('سورة الكهف');
    expect(plan.find((p) => p.id === 'khatma-k-2026-10-29')?.body).toBe('ورد اليوم: من صفحة 21 إلى 40');
  });
});

describe('notification language', () => {
  it('writes notifications in English when the interface is English', () => {
    const now = new Date('2026-10-24T10:00:00Z');
    const plan = planNotifications({ now, place: riyadh, prayer: DEFAULT_PRAYER_SETTINGS, settings: DEFAULT_NOTIFICATION_SETTINGS, lang: 'en' });
    expect(plan[0].title).toBe('Asr in 5 minutes');
    expect(plan[1].title).toBe('It is time for Asr');
    expect(plan[1].body).toMatch(/PM$/);
  });
});

describe('adhan sound settings', () => {
  it('maps sounds saved by earlier versions to the bundled adhan', () => {
    const { normalizeAdhanSound } = jest.requireActual('../notification-plan') as typeof import('../notification-plan');
    expect(normalizeAdhanSound('adhan-makkah')).toBe('adhan');
    expect(normalizeAdhanSound('adhan-short')).toBe('adhan');
    expect(normalizeAdhanSound('takbir')).toBe('takbir');
    expect(normalizeAdhanSound('silent')).toBe('silent');
    expect(normalizeAdhanSound(undefined)).toBe('adhan');
  });
});

describe('fajr wake-up and prayer actions', () => {
  const now = new Date('2026-10-30T00:00:00Z');
  const settings = { ...DEFAULT_NOTIFICATION_SETTINGS, fajrWake: { enabled: true } };

  it('repeats the Fajr alert until it is answered, and tags each adhan with its prayer', () => {
    const plan = planNotifications({ now, place: riyadh, prayer: DEFAULT_PRAYER_SETTINGS, settings, days: 2 });
    const fajr = plan.find((p) => p.id === 'adhan-fajr-2026-10-30')!;
    expect(fajr.route).toBe('/fajr-wake');
    expect([fajr.prayer, fajr.date]).toEqual(['fajr', '2026-10-30']);
    const wakes = plan.filter((p) => p.id.startsWith('fajr-wake-2026-10-30'));
    expect(wakes.map((w) => Math.round((w.at.getTime() - fajr.at.getTime()) / 60000))).toEqual([3, 6, 9, 12]);
    expect(plan.find((p) => p.id === 'adhan-dhuhr-2026-10-30')?.route).toBe('/between');

    const answered = planNotifications({ now, place: riyadh, prayer: DEFAULT_PRAYER_SETTINGS, settings, days: 2, fajrWokeOn: '2026-10-30' });
    expect(answered.some((p) => p.id.startsWith('fajr-wake-2026-10-30'))).toBe(false);
    expect(answered.some((p) => p.id.startsWith('fajr-wake-2026-10-31'))).toBe(true);
  });
});
