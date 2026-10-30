import { prayerConflicts, type CalendarItem } from '../calendar-conflicts';
import type { DayTimes } from '../prayer-times';

const at = (h: number, m = 0) => new Date(2026, 9, 30, h, m);
const day: DayTimes = {
  date: { year: 2026, month: 10, day: 30 },
  times: { fajr: at(4, 50), sunrise: at(6, 5), dhuhr: at(11, 40), asr: at(14, 55), maghrib: at(17, 20), isha: at(18, 50) },
  midnight: at(23, 50),
  lastThird: at(1, 50),
  isFriday: true,
  hijriMonth: 5,
} as DayTimes;
const item = (id: string, s: Date, e: Date, allDay = false): CalendarItem => ({ id, title: id, start: s, end: e, allDay });

describe('prayerConflicts', () => {
  it('finds an appointment that covers the adhan', () => {
    const c = prayerConflicts([item('meeting', at(11), at(12, 30))], [day]);
    expect(c.map((x) => x.prayer)).toEqual(['dhuhr']);
    expect(c[0].isFriday).toBe(true);
  });
  it('finds one that starts just after the adhan, but not much later', () => {
    expect(prayerConflicts([item('a', at(11, 45), at(12, 30))], [day])).toHaveLength(1);
    expect(prayerConflicts([item('b', at(12, 0), at(12, 30))], [day])).toHaveLength(0);
  });
  it('ignores all-day events, sunrise and appointments that end at the adhan', () => {
    expect(prayerConflicts([item('c', at(0), at(23, 59), true), item('d', at(6), at(6, 30)), item('e', at(14), at(14, 55))], [day])).toHaveLength(0);
  });
  it('lists every prayer a long appointment covers, in order', () => {
    expect(prayerConflicts([item('trip', at(10), at(19))], [day]).map((x) => x.prayer)).toEqual(['dhuhr', 'asr', 'maghrib', 'isha']);
  });
});
