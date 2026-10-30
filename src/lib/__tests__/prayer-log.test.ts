import { adjustQada, countMarks, EMPTY_QADA, isCompleteDay, lastWeek, markPrayer, rawatibRakahs, streak, toggleNafila, witrStreak, type PrayerLog } from '../prayer-log';

const day = (d: number) => ({ year: 2026, month: 11, day: d });
const empty: PrayerLog = { days: {}, qada: { ...EMPTY_QADA } };
const fullDay = (log: PrayerLog, d: number) =>
  (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).reduce((l, id) => markPrayer(l, day(d), id, 'ontime'), log);

describe('prayer log', () => {
  it('marks prayers and keeps the qada count in step with missed prayers', () => {
    let log = markPrayer(empty, day(3), 'fajr', 'missed');
    expect(log.days['2026-11-03'].fajr).toBe('missed');
    expect(log.qada.fajr).toBe(1);
    log = markPrayer(log, day(3), 'fajr', 'missed');
    expect(log.qada.fajr).toBe(1);
    log = markPrayer(log, day(3), 'fajr', 'late');
    expect(log.qada.fajr).toBe(0);
    log = markPrayer(log, day(3), 'fajr', null);
    expect(log.days['2026-11-03'].fajr).toBeUndefined();
    expect(empty.qada.fajr).toBe(0);
  });

  it('adjusts qada by hand without going below zero', () => {
    expect(adjustQada(empty, 'isha', 30).qada.isha).toBe(30);
    expect(adjustQada(empty, 'isha', -1).qada.isha).toBe(0);
  });

  it('toggles voluntary prayers', () => {
    const on = toggleNafila(empty, day(1), 'witr');
    expect(on.days['2026-11-01'].nafila).toEqual({ witr: true });
    expect(toggleNafila(on, day(1), 'witr').days['2026-11-01'].nafila).toEqual({});
  });

  it('counts a streak of complete days, allowing today to be in progress', () => {
    let log = fullDay(fullDay(fullDay(empty, 1), 2), 3);
    expect(streak(log, day(3))).toBe(3);
    expect(streak(log, day(4))).toBe(3);
    log = markPrayer(log, day(2), 'asr', 'missed');
    expect(isCompleteDay(log.days['2026-11-02'])).toBe(false);
    expect(streak(log, day(4))).toBe(1);
    expect(streak(log, day(6))).toBe(0);
  });

  it('summarises a week', () => {
    let log = fullDay(empty, 5);
    log = markPrayer(log, day(6), 'fajr', 'jamaah');
    log = markPrayer(log, day(6), 'isha', 'missed');
    const counts = countMarks(log, day(1), 7);
    expect(counts).toEqual({ jamaah: 1, ontime: 5, late: 0, missed: 1, unmarked: 28 });
    const week = lastWeek(log, day(7));
    expect(week).toHaveLength(7);
    expect(week[0].date).toEqual(day(1));
    expect(week[5].day.fajr).toBe('jamaah');
  });
});

describe('rawatib and witr', () => {
  const d = (n: number) => ({ year: 2026, month: 10, day: n });

  it('counts the rak‘ahs of the rawatib', () => {
    let log = toggleNafila(empty, d(1), 'r-fajr');
    log = toggleNafila(log, d(1), 'r-dhuhr-before');
    expect(rawatibRakahs(log.days['2026-10-01'])).toBe(6);
    log = toggleNafila(log, d(1), 'r-fajr');
    expect(rawatibRakahs(log.days['2026-10-01'])).toBe(4);
  });

  it('counts consecutive nights of witr', () => {
    let log = toggleNafila(empty, d(27), 'witr');
    log = toggleNafila(log, d(28), 'witr');
    log = toggleNafila(log, d(29), 'witr');
    expect(witrStreak(log, d(30))).toBe(3);
    log = toggleNafila(log, d(30), 'witr');
    expect(witrStreak(log, d(30))).toBe(4);
    expect(witrStreak(log, d(31))).toBe(4);
    expect(witrStreak(empty, d(30))).toBe(0);
  });
});
