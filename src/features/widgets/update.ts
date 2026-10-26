// Computes widget content in the app and hands it to the native widgets. iOS receives a
// timeline (one entry per prayer change) so widgets stay correct without the app running.
import { Platform } from 'react-native';

import { getDailyAyah, getDailyDua, getDailyHadith } from '@/data/content';
import { stripDiacritics } from '@/lib/arabic';
import { addCivilDays, civilWeekday, formatCivil, formatHijri, toHijri, WEEKDAYS } from '@/lib/hijri';
import { status as khatmaStatus } from '@/lib/khatma';
import { computeDay, prayerLabel, SALAH_IDS, type DayTimes } from '@/lib/prayer-times';
import { bannerState } from '@/lib/ramadan';
import { civilDateIn, formatTime } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { useKhatmaStore } from '@/store/user';
import { DailyWidget, DateWidget, KhatmaWidget, PrayerWidget, supportsTimeline, widgetsAvailable } from '@/widgets';
import type { PrayerWidgetProps, WidgetStyle } from '@/widgets/types';

const STYLE: WidgetStyle = 'green';

function prayerProps(day: DayTimes, nextIndex: number, city: string, tz: string, digits: 'latin' | 'arabic'): PrayerWidgetProps {
  const h = toHijri(day.date, useSettings.getState().prayer.hijriOffset);
  return {
    city,
    hijri: formatHijri(h),
    weekday: WEEKDAYS[civilWeekday(day.date)],
    prayers: SALAH_IDS.map((id) => ({ name: prayerLabel(id, day.isFriday), time: formatTime(day.times[id], tz, digits), at: day.times[id].getTime() })),
    nextIndex,
    style: STYLE,
  };
}

const short = (text: string, max = 260) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

export async function refreshWidgets(): Promise<void> {
  if (!widgetsAvailable || Platform.OS === 'web') return;
  const { location, prayer, digits } = useSettings.getState();
  const now = new Date();
  if (location) {
    const tz = location.timezone;
    const today = civilDateIn(now, tz);
    const days = [0, 1, 2].map((o) => computeDay(addCivilDays(today, o), location, prayer));
    // One timeline entry starting at each prayer: from then on, the following prayer is "next".
    const entries: { date: Date; props: PrayerWidgetProps }[] = [];
    for (let d = 0; d < days.length; d++) {
      for (let i = 0; i < SALAH_IDS.length; i++) {
        const start = i === 0 ? (d === 0 ? now : days[d - 1].times.isha) : days[d].times[SALAH_IDS[i - 1]];
        entries.push({ date: start, props: prayerProps(days[d], i, location.name, tz, digits) });
      }
    }
    const upcoming = entries.filter((e, idx) => {
      const nextAt = e.props.prayers[e.props.nextIndex].at;
      return nextAt > now.getTime() || idx === entries.length - 1;
    });
    const current = upcoming[0];
    if (supportsTimeline) PrayerWidget.updateTimeline(upcoming.map((e, i) => ({ date: i === 0 ? now : e.date, props: e.props })));
    else if (current) PrayerWidget.updateSnapshot(current.props);

    const h = toHijri(today, prayer.hijriOffset);
    const banner = bannerState(now, location, prayer);
    const note =
      banner.kind === 'before-ramadan'
        ? `باقٍ ${banner.daysLeft} يومًا على رمضان`
        : banner.kind === 'ramadan'
          ? `اليوم ${banner.day} من رمضان`
          : banner.kind === 'eid'
            ? `عيد ${banner.name} مبارك`
            : '';
    DateWidget.updateSnapshot({ hijri: formatHijri(h), gregorian: formatCivil(today), weekday: WEEKDAYS[civilWeekday(today)], note, style: 'cream' });

    const [ayah, hadith, dua] = await Promise.all([getDailyAyah(today), getDailyHadith(today), getDailyDua(today)]);
    DailyWidget.updateSnapshot({
      ayah: { text: short(stripDiacritics(ayah.text).replace(/[٠-٩]+/g, '۝')), ref: ayah.reference },
      hadith: { text: short(hadith.text), ref: `${hadith.attribution} — ${hadith.grade}` },
      dhikr: { text: short(stripDiacritics(dua.text).replace(/[٠-٩]+/g, '۝')), ref: dua.reference },
      style: 'cream',
    });

    const khatma = useKhatmaStore.getState().khatmas.find((k) => k.status === 'active');
    if (khatma) {
      const s = khatmaStatus(khatma, today);
      KhatmaWidget.updateSnapshot({
        name: khatma.name,
        percent: Math.round(s.percent),
        today: s.today ? `ورد اليوم: ${s.today.from}–${s.today.to}` : 'أحسنت، أتممت ورد اليوم',
        detail: `باقٍ ${s.pagesLeft} صفحة • ${s.daysLeft} يومًا`,
        style: STYLE,
      });
    } else {
      KhatmaWidget.updateSnapshot({ name: 'الختمة', percent: 0, today: 'ابدأ ختمة جديدة من التطبيق', detail: '', style: STYLE });
    }
  }
}
