import { addCivilDays, daysBetween, formatHijri, toGregorian, toHijri } from '../hijri';
import { DEFAULT_PRAYER_SETTINGS, type PlaceLocation } from '../prayer-times';
import { bannerState, upcomingVoluntaryFasts } from '../ramadan';
import { formatCountdown, formatDurationWords, formatTime, instantAt } from '../time';

const riyadh: PlaceLocation = { name: 'الرياض', lat: 24.7136, lng: 46.6753, timezone: 'Asia/Riyadh', source: 'manual' };

describe('hijri (Umm al-Qura)', () => {
  it('converts 24 October 2026 to 13 Jumada al-Ula 1448', () => {
    expect(toHijri({ year: 2026, month: 10, day: 24 })).toEqual({ year: 1448, month: 5, day: 13 });
    expect(formatHijri({ year: 1448, month: 5, day: 13 })).toBe('13 جمادى الأولى 1448هـ');
  });

  it('round-trips and honours a manual offset', () => {
    const g = { year: 2027, month: 3, day: 1 };
    expect(toGregorian(toHijri(g))).toEqual(g);
    const plusOne = toHijri(g, 1);
    expect(daysBetween(toGregorian(toHijri(g)), toGregorian(plusOne))).toBe(1);
    expect(toGregorian(plusOne, 1)).toEqual(g);
  });

  it('handles month and year boundaries', () => {
    expect(addCivilDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
    expect(daysBetween({ year: 2026, month: 2, day: 27 }, { year: 2026, month: 3, day: 1 })).toBe(2);
  });
});

describe('time formatting', () => {
  it('formats 12-hour Arabic times and countdowns', () => {
    const at = instantAt({ year: 2026, month: 10, day: 24 }, 14, 53, 'Asia/Riyadh');
    expect(formatTime(at, 'Asia/Riyadh')).toBe('2:53 م');
    expect(formatTime(at, 'Asia/Riyadh', 'arabic')).toBe('٢:٥٣ م');
    expect(formatCountdown(5006_000)).toBe('01:23:26');
    expect(formatDurationWords(83 * 60000)).toBe('ساعة و23 د');
    expect(formatDurationWords(5 * 60000)).toBe('5 د');
  });
});

describe('home banner', () => {
  it('shows the next prayer outside Ramadan season', () => {
    const now = instantAt({ year: 2026, month: 10, day: 24 }, 13, 29, 'Asia/Riyadh');
    const s = bannerState(now, riyadh, DEFAULT_PRAYER_SETTINGS);
    expect(s.kind).toBe('prayer');
    if (s.kind === 'prayer') expect(s.id).toBe('asr');
  });

  it('counts down the days before Ramadan', () => {
    const start = toGregorian({ year: 1448, month: 9, day: 1 });
    const tenBefore = addCivilDays(start, -10);
    const s = bannerState(instantAt(tenBefore, 12, 0, 'Asia/Riyadh'), riyadh, DEFAULT_PRAYER_SETTINGS);
    expect(s).toMatchObject({ kind: 'before-ramadan', daysLeft: 10 });
  });

  it('switches between imsak and iftar countdowns during Ramadan', () => {
    const day3 = toGregorian({ year: 1448, month: 9, day: 3 });
    const night = bannerState(instantAt(day3, 3, 0, 'Asia/Riyadh'), riyadh, DEFAULT_PRAYER_SETTINGS);
    expect(night).toMatchObject({ kind: 'ramadan', day: 3, phase: 'until-imsak' });
    const noon = bannerState(instantAt(day3, 12, 0, 'Asia/Riyadh'), riyadh, DEFAULT_PRAYER_SETTINGS);
    expect(noon).toMatchObject({ kind: 'ramadan', day: 3, phase: 'until-iftar' });
    const evening = bannerState(instantAt(day3, 21, 0, 'Asia/Riyadh'), riyadh, DEFAULT_PRAYER_SETTINGS);
    expect(evening).toMatchObject({ kind: 'ramadan', day: 4, phase: 'until-imsak' });
  });

  it('returns to prayer times after Eid', () => {
    const shawwal5 = toGregorian({ year: 1448, month: 10, day: 5 });
    const s = bannerState(instantAt(shawwal5, 12, 0, 'Asia/Riyadh'), riyadh, DEFAULT_PRAYER_SETTINGS);
    expect(s.kind).toBe('prayer');
    const eid = bannerState(instantAt(toGregorian({ year: 1448, month: 10, day: 1 }), 12, 0, 'Asia/Riyadh'), riyadh, DEFAULT_PRAYER_SETTINGS);
    expect(eid).toMatchObject({ kind: 'eid', name: 'الفطر' });
  });
});

describe('voluntary fasts', () => {
  it('suggests Mondays, Thursdays and the white days but never Ramadan or Eid', () => {
    const from = toGregorian({ year: 1448, month: 5, day: 10 });
    const fasts = upcomingVoluntaryFasts(from, 10);
    const white = fasts.filter((f) => f.reason === 'white-days').map((f) => toHijri(f.date).day);
    expect(white).toEqual([13, 14, 15]);
    for (const f of fasts.filter((x) => x.reason === 'monday')) {
      expect(new Date(Date.UTC(f.date.year, f.date.month - 1, f.date.day)).getUTCDay()).toBe(1);
    }
    const ramadan = upcomingVoluntaryFasts(toGregorian({ year: 1448, month: 9, day: 1 }), 30);
    expect(ramadan).toHaveLength(0);
  });

  it('includes Arafah and Ashura', () => {
    const arafah = upcomingVoluntaryFasts(toGregorian({ year: 1448, month: 12, day: 9 }), 1);
    expect(arafah[0].reason).toBe('arafah');
    const ashura = upcomingVoluntaryFasts(toGregorian({ year: 1449, month: 1, day: 10 }), 1);
    expect(ashura[0].reason).toBe('ashura');
  });
});
