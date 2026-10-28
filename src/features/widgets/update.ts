// Computes widget content in the app and hands it to the native widgets. iOS receives a
// timeline (one entry per prayer change) so widgets stay correct without the app running.
import { Asset } from 'expo-asset';
import { Directory, File } from 'expo-file-system';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

import { getDailyAyah, getDailyDua, getDailyHadith } from '@/data/content';
import { stripDiacritics } from '@/lib/arabic';
import { addCivilDays, civilWeekday, formatCivil, formatHijri, toHijri, WEEKDAYS } from '@/lib/hijri';
import { status as khatmaStatus } from '@/lib/khatma';
import { computeDay } from '@/lib/prayer-times';
import { prayerWidgetTimeline } from '@/lib/widget-timeline';
import { bannerState } from '@/lib/ramadan';
import { civilDateIn } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { useKhatmaStore } from '@/store/user';
import { DailyWidget, DateWidget, KhatmaWidget, PrayerWidget, supportsTimeline, widgetFolder, widgetsAvailable } from '@/widgets';
import { WEEKDAY_ART } from '@/widgets/art';
import { KHATMA_DEFAULT } from '@/widgets/defaults';
import type { PrayerWidgetProps, WidgetStyle } from '@/widgets/types';

const STYLE: WidgetStyle = 'green';

// The calligraphic weekday names (scripts/make-widget-art.mjs), copied once into the folder
// the widgets can read. Bump ART_VERSION when the images change.
const ART_VERSION = 'art-v1';
const ART = WEEKDAY_ART.flatMap((art, i) => [
  { name: `weekday-${i}-light.png`, module: art.light },
  { name: `weekday-${i}-dark.png`, module: art.dark },
]);

async function widgetArtDir(): Promise<string | null> {
  if (!widgetFolder || !ART.length) return null;
  try {
    const dir = new Directory(widgetFolder, ART_VERSION);
    if (!dir.exists) dir.create({ intermediates: true });
    for (const a of ART) {
      const target = new File(dir, a.name);
      if (target.exists) continue;
      const [asset] = await Asset.loadAsync(a.module);
      if (asset.localUri) new File(asset.localUri).copy(target);
    }
    return dir.uri.replace(/\/$/, '');
  } catch {
    return null;
  }
}

/** Whether the device lays out right-to-left; widgets follow the device, not the app. */
const deviceRTL = () => getLocales()[0]?.textDirection === 'rtl';

const short = (text: string, max = 260) => {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

export async function refreshWidgets(): Promise<void> {
  if (!widgetsAvailable || Platform.OS === 'web') return;
  const { location, prayer } = useSettings.getState();
  const now = new Date();
  if (location) {
    const tz = location.timezone;
    const today = civilDateIn(now, tz);
    const days = [-1, 0, 1, 2].map((o) => computeDay(addCivilDays(today, o), location, prayer));
    const lang = useSettings.getState().language;
    const artDir = await widgetArtDir();
    const reverse = (lang === 'ar') !== deviceRTL();
    const entries = prayerWidgetTimeline(days, now, { timeZone: tz, lang, hijriOffset: prayer.hijriOffset }).map((e) => ({
      date: e.date,
      props: {
        ...e.props,
        city: location.name,
        lang,
        reverse,
        artDir,
        nextLine: lang === 'ar' ? `القادمة: ${e.props.next.name} ${e.props.next.time}` : `Next: ${e.props.next.name} ${e.props.next.time}`,
      } satisfies PrayerWidgetProps,
    }));
    if (supportsTimeline) PrayerWidget.updateTimeline(entries);
    else if (entries[0]) PrayerWidget.updateSnapshot(entries[0].props);

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
      ayah: { text: short(ayah.textPlain ?? stripDiacritics(ayah.text)), ref: ayah.reference },
      hadith: { text: short(hadith.text), ref: `${hadith.attribution} — ${hadith.grade}` },
      dhikr: { text: short(dua.textPlain ?? stripDiacritics(dua.text)), ref: dua.reference },
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
      KhatmaWidget.updateSnapshot(KHATMA_DEFAULT);
    }
  }
}
