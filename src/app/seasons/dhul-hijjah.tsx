// «عشر ذي الحجة»: the ten days, the Day of Arafah for those not on pilgrimage (its fast, its dua and
// the day's times), and the takbir of the days of Tashreeq.
import { router } from 'expo-router';
import { HandHeart, Megaphone, MapPin } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, QuranText, Txt } from '@/components/ui';
import { getSurahs, getVerseByKey, type Verse } from '@/data/content';
import { Evidence } from '@/features/hadith/evidence';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { toArabicDigits } from '@/lib/arabic';
import { addCivilDays, toHijri, type CivilDate } from '@/lib/hijri';
import { computeDay } from '@/lib/prayer-times';
import { useSettings } from '@/store/settings';

const TEN_DAYS = 6255; // No days in which good deeds are more beloved to Allah (al-Bukhari)
const ARAFAH_FAST = 65874; // Fasting Arafah expiates the year before and after (Muslim)
const TASHREEQ = 65519; // The days of Tashreeq are days of eating and drinking (Muslim)
const ARAFAH_CHAPTER = 119;

/** The next date with the given Hijri month and day (today included). */
function nextHijri(from: CivilDate, month: number, day: number, offset: number): CivilDate | null {
  for (let i = 0; i < 400; i++) {
    const d = addCivilDays(from, i);
    const h = toHijri(d, offset);
    if (h.month === month && h.day === day) return d;
  }
  return null;
}

export default function DhulHijjah() {
  const { tr } = useI18n();
  const f = useFormat();
  const today = useToday();
  const offset = useSettings((s) => s.prayer.hijriOffset);
  const location = useSettings((s) => s.location);
  const prayer = useSettings((s) => s.prayer);
  const [verse, setVerse] = useState<Verse | null>(null);
  const [surah, setSurah] = useState('');
  useEffect(() => {
    Promise.all([getVerseByKey(2, 203), getSurahs()]).then(([v, s]) => {
      setVerse(v);
      setSurah(s[1]?.name ?? '');
    });
  }, []);

  const h = toHijri(today, offset);
  const inTen = h.month === 12 && h.day <= 10;
  const arafah = nextHijri(today, 12, 9, offset);
  const times = arafah && location ? computeDay(arafah, location, prayer).times : null;
  const tz = location?.timezone;

  return (
    <Screen title={tr('عشر ذي الحجة', 'The ten days of Dhul-Hijjah')} subtitle={tr('أحب الأيام إلى الله للعمل الصالح', 'The days good deeds are most beloved to Allah')}>
      {inTen ? (
        <Card tone="primary">
          <Txt variant="subheading" color="#FFFFFF">
            {tr(`اليوم ${h.day} من العشر`, `Day ${h.day} of the ten`)}
          </Txt>
        </Card>
      ) : null}
      <Evidence id={TEN_DAYS} full />

      <Card style={{ gap: 10 }}>
        <Txt variant="subheading">{tr('يوم عرفة لغير الحاج', 'The Day of Arafah (not on pilgrimage)')}</Txt>
        {arafah ? (
          <Txt muted>
            {tr(`${f.weekday(arafah)} ${f.civil(arafah)}، بحسب تقويم التطبيق`, `${f.weekday(arafah)} ${f.civil(arafah)}, by the app’s calendar`)}
          </Txt>
        ) : null}
        {times && tz ? (
          <View style={{ gap: 6 }}>
            {[
              [tr('السحور والنية قبل الفجر', 'Suhoor before Fajr'), f.time(times.fajr, tz)],
              [tr('الصيام والذكر والتكبير طوال النهار', 'Fasting, dhikr and takbir through the day'), `${f.time(times.fajr, tz)} – ${f.time(times.maghrib, tz)}`],
              [tr('الدعاء، والإكثار منه إلى الغروب', 'Dua, plenty of it, until sunset'), f.time(times.maghrib, tz)],
            ].map(([label, time]) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt style={{ flex: 1 }}>{label}</Txt>
                <Txt variant="caption" weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>
                  {time}
                </Txt>
              </View>
            ))}
          </View>
        ) : !location ? (
          <Button title={tr('حدّد موقعك لترى أوقاته', 'Set your location to see its times')} icon={MapPin} tone="soft" onPress={() => router.push('/location')} />
        ) : null}
        <Evidence id={ARAFAH_FAST} />
        <Button title={tr('الدعاء يوم عرفة', 'The dua of Arafah')} icon={HandHeart} onPress={() => router.push({ pathname: '/adhkar/[id]', params: { id: `hisn:${ARAFAH_CHAPTER}` } })} />
      </Card>

      <Card style={{ gap: 10 }}>
        <Txt variant="subheading">{tr('العيد وأيام التشريق', 'Eid and the days of Tashreeq')}</Txt>
        {verse ? (
          <View style={{ gap: 4 }}>
            <QuranText size={22}>{`${verse.textQpc.split(' ').slice(0, 6).join(' ')}… ${toArabicDigits(verse.ayah)}`}</QuranText>
            <Txt variant="caption" muted center>{`سورة ${surah}: ${verse.ayah}`}</Txt>
          </View>
        ) : null}
        <Evidence id={TASHREEQ} full />
        <Button title={tr('عدّاد التكبير', 'Takbir counter')} icon={Megaphone} tone="soft" onPress={() => router.push({ pathname: '/adhkar/pulse', params: { mode: 'takbir' } })} />
      </Card>
      <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
        {tr('التواريخ بحسب التقويم المختار في التطبيق، وقد تختلف بيوم بحسب إعلان بلدك.', 'Dates follow the calendar chosen in the app and may differ by a day from your country’s announcement.')}
      </Txt>
    </Screen>
  );
}
