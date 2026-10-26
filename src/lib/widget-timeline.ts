// The prayer widget's timeline: one entry whenever what it shows changes — at each prayer
// (the next one moves on) and at midnight (the date and weekday turn over). After Isha the
// widget keeps today's date and times and counts down to tomorrow's Fajr, until midnight.
import { toArabicDigits } from './arabic';
import { civilWeekday, toHijri, weekdayName } from './hijri';
import { prayerLabel, SALAH_IDS, type DayTimes } from './prayer-times';
import { formatTime, instantAt, zonedParts } from './time';

export type WidgetPrayerTime = { name: string; time: string; clock: string; at: number };

export type PrayerWidgetEntry = {
  /** «١٥-٠٥-١٤٤٨», kept left-to-right like a printed date. */
  hijriNumeric: string;
  weekday: string;
  /** 0 = Sunday, for the calligraphic weekday image. */
  weekdayIndex: number;
  prayers: WidgetPrayerTime[];
  nextIndex: number;
  next: { name: string; time: string; at: number };
  prev: { name: string; time: string; at: number };
  /** «باقي على الفجر» / «مضى على العشاء». */
  remainingLabel: string;
  sinceLabel: string;
};

type Options = { timeZone: string; lang: 'ar' | 'en'; hijriOffset: number };

/** `days` are consecutive, starting with yesterday (for the prayer before the first one today). */
export function prayerWidgetTimeline(days: DayTimes[], now: Date, o: Options): { date: Date; props: PrayerWidgetEntry }[] {
  const ar = o.lang === 'ar';
  const num = (v: string) => (ar ? toArabicDigits(v) : v);
  const events = days.flatMap((day, d) => SALAH_IDS.map((id, idx) => ({ d, idx, id, at: day.times[id].getTime() })));
  const midnights = days.map((day) => instantAt(day.date, 0, 0, o.timeZone).getTime());
  const label = (e: (typeof events)[number]) => prayerLabel(e.id, days[e.d].isFriday, o.lang);
  const time = (at: number) => formatTime(new Date(at), o.timeZone, ar ? 'arabic' : 'latin', false, o.lang);
  const clock = (at: number) => {
    const p = zonedParts(new Date(at), o.timeZone);
    return num(`${p.hour % 12 === 0 ? 12 : p.hour % 12}:${String(p.minute).padStart(2, '0')}`);
  };

  const starts = [now.getTime(), ...events.map((e) => e.at), ...midnights].filter((t) => t >= now.getTime());
  const unique = [...new Set(starts)].sort((a, b) => a - b);
  const entries: { date: Date; props: PrayerWidgetEntry }[] = [];
  for (const start of unique) {
    const next = events.find((e) => e.at > start);
    const prev = [...events].reverse().find((e) => e.at <= start);
    if (!next || !prev) break;
    // The day on the clock at `start`.
    let shown = 0;
    for (let k = 0; k < days.length; k++) if (midnights[k] <= start) shown = k;
    const day = days[shown];
    const h = toHijri(day.date, o.hijriOffset);
    const pad = (n: number) => String(n).padStart(2, '0');
    const weekdayIndex = civilWeekday(day.date);
    entries.push({
      date: new Date(start),
      props: {
        hijriNumeric: `\u2066${num(`${pad(h.day)}-${pad(h.month)}-${h.year}`)}\u2069`,
        weekday: weekdayName(weekdayIndex, o.lang),
        weekdayIndex,
        prayers: SALAH_IDS.map((id) => ({ name: prayerLabel(id, day.isFriday, o.lang), time: time(day.times[id].getTime()), clock: clock(day.times[id].getTime()), at: day.times[id].getTime() })),
        nextIndex: next.idx,
        next: { name: label(next), time: time(next.at), at: next.at },
        prev: { name: label(prev), time: time(prev.at), at: prev.at },
        remainingLabel: ar ? `باقي على ${label(next)}` : `${label(next)} in`,
        sinceLabel: ar ? `مضى على ${label(prev)}` : `Since ${label(prev)}`,
      },
    });
  }
  return entries;
}

