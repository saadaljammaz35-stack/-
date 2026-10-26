import { addCivilDays } from '../hijri';
import { computeDay, DEFAULT_PRAYER_SETTINGS, type PlaceLocation } from '../prayer-times';
import { prayerWidgetTimeline } from '../widget-timeline';

const riyadh: PlaceLocation = { name: 'الرياض', lat: 24.7136, lng: 46.6753, timezone: 'Asia/Riyadh', source: 'manual' };
const monday = { year: 2026, month: 10, day: 26 };
const days = [-1, 0, 1, 2].map((o) => computeDay(addCivilDays(monday, o), riyadh, DEFAULT_PRAYER_SETTINGS));
const opts = { timeZone: 'Asia/Riyadh', lang: 'ar' as const, hijriOffset: 0 };

describe('prayer widget timeline', () => {
  it('after Isha keeps today and counts down to tomorrow’s Fajr, then turns the day at midnight', () => {
    const now = new Date('2026-10-26T22:00:00+03:00');
    const [first, second] = prayerWidgetTimeline(days, now, opts);
    expect(first.date.getTime()).toBe(now.getTime());
    expect(first.props.weekday).toBe('الاثنين');
    expect(first.props.weekdayIndex).toBe(1);
    expect(first.props.next.name).toBe('الفجر');
    expect(first.props.next.at).toBe(days[2].times.fajr.getTime());
    expect(first.props.nextIndex).toBe(0);
    expect(first.props.prev.name).toBe('العشاء');
    expect(first.props.remainingLabel).toBe('باقي على الفجر');
    expect(first.props.sinceLabel).toBe('مضى على العشاء');
    expect(second.date.toISOString()).toBe('2026-10-26T21:00:00.000Z'); // midnight in Riyadh
    expect(second.props.weekday).toBe('الثلاثاء');
    expect(second.props.next.name).toBe('الفجر');
  });

  it('moves the highlight at each prayer and writes Arabic digits', () => {
    const now = new Date('2026-10-26T13:00:00+03:00');
    const entries = prayerWidgetTimeline(days, now, opts);
    expect(entries[0].props.next.name).toBe('العصر');
    expect(entries[0].props.nextIndex).toBe(2);
    expect(entries[1].date.getTime()).toBe(days[1].times.asr.getTime());
    expect(entries[1].props.next.name).toBe('المغرب');
    expect(entries[0].props.prayers[0].clock).toMatch(/^[٠-٩]{1,2}:[٠-٩]{2}$/);
    expect(entries[0].props.hijriNumeric).toBe('⁦١٥-٠٥-١٤٤٨⁩');
    // Entries are strictly increasing and stop when no prayer is left to count down to.
    for (let i = 1; i < entries.length; i++) expect(entries[i].date.getTime()).toBeGreaterThan(entries[i - 1].date.getTime());
    expect(entries.at(-1)!.props.next.at).toBeLessThanOrEqual(days[3].times.isha.getTime());
  });

  it('speaks English when the app does', () => {
    const [e] = prayerWidgetTimeline(days, new Date('2026-10-26T13:00:00+03:00'), { ...opts, lang: 'en' });
    expect(e.props.weekday).toBe('Monday');
    expect(e.props.remainingLabel).toBe('Asr in');
    expect(e.props.prayers[1].clock).toMatch(/^\d{1,2}:\d{2}$/);
  });
});
