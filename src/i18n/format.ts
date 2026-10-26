// Display formatting bound to the user's language, digit style and clock preference.
import { useMemo } from 'react';

import { civilWeekday, formatCivil, formatHijri, gregorianMonthName, hijriMonthName, weekdayName, weekdayShort, type CivilDate, type HijriDate } from '@/lib/hijri';
import { prayerLabel, type PrayerId } from '@/lib/prayer-times';
import { formatTime } from '@/lib/time';
import { useSettings } from '@/store/settings';

import { useI18n } from '.';

export function useFormat() {
  const { lang } = useI18n();
  const digitStyle = useSettings((s) => s.digits);
  const use24h = useSettings((s) => s.use24h);
  return useMemo(
    () => ({
      time: (date: Date, timeZone: string, force24h = false) => formatTime(date, timeZone, digitStyle, force24h || use24h, lang),
      prayer: (id: PrayerId, isFriday = false) => prayerLabel(id, isFriday, lang),
      hijri: (h: HijriDate) => formatHijri(h, lang),
      civil: (d: CivilDate) => formatCivil(d, lang),
      weekday: (d: CivilDate) => weekdayName(civilWeekday(d), lang),
      weekdayShort: (index: number) => weekdayShort(index, lang),
      hijriMonth: (month: number) => hijriMonthName(month, lang),
      gregorianMonth: (month: number) => gregorianMonthName(month, lang),
    }),
    [lang, digitStyle, use24h],
  );
}
