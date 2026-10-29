// «الهلال الليلة»: on the evenings that end a Hijri month, whether the new crescent can be seen
// from the user's city, by Odeh's criterion, with the moon's age and how long it stays after
// sunset. An astronomical estimate only: the sighting and the official announcement decide.
import { router } from 'expo-router';
import { MapPin, MoonStar } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Badge, Button, Card, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { addCivilDays, hijriMonthName, toHijri, type CivilDate } from '@/lib/hijri';
import { crescentOn, type Crescent, type CrescentZone } from '@/lib/sky-events';
import { civilDateIn, instantAt } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const SIGHTING_HADITH = 65492; // «صوموا لرؤيته وأفطروا لرؤيته…»
const DUA_CHAPTER = 'situation:hilal';

export default function Hilal() {
  const t = useTheme();
  const { tr, lang } = useI18n();
  const f = useFormat();
  const today = useToday();
  const location = useSettings((s) => s.location);
  const offset = useSettings((s) => s.prayer.hijriOffset);

  // The evenings of the 29th and 30th of this Hijri month (or the next, once they have passed).
  const evenings = useMemo(() => {
    if (!location) return [];
    const out: { date: CivilDate; hijriDay: number; month: number; c: Crescent | null }[] = [];
    for (let i = 0; i < 32 && out.length < 2; i++) {
      const d = addCivilDays(today, i);
      const h = toHijri(d, offset);
      if (h.day >= 29) {
        const c = crescentOn(instantAt(d, 12, 0, location.timezone), location.lat, location.lng);
        out.push({ date: d, hijriDay: h.day, month: h.month, c });
      }
    }
    return out;
  }, [location, today, offset]);

  if (!location) {
    return (
      <Screen title={tr('الهلال', 'The crescent')}>
        <Button title={tr('حدّد موقعك أولًا', 'Set your location first')} icon={MapPin} onPress={() => router.push('/location')} />
      </Screen>
    );
  }
  const tz = location.timezone;
  const nextMonth = (m: number) => hijriMonthName((m % 12) + 1, lang);
  const ZONES: Record<CrescentZone, { label: string; tone: 'sahih' | 'hasan' | 'daif' | 'soft' }> = {
    'naked-eye': { label: tr('يُرى بالعين المجردة', 'Visible to the naked eye'), tone: 'sahih' },
    'optical-maybe-eye': { label: tr('يُرى بالمنظار وقد يُرى بالعين', 'Visible with optics, maybe by eye'), tone: 'hasan' },
    'optical-only': { label: tr('بالمنظار فقط', 'With optics only'), tone: 'soft' },
    'not-visible': { label: tr('لا يُرى', 'Not visible'), tone: 'daif' },
    impossible: { label: tr('مستحيل الرؤية', 'Cannot be seen'), tone: 'daif' },
  };

  return (
    <Screen title={tr('الهلال', 'The crescent')} subtitle={tr(`إمكان رؤيته من ${location.name}`, `Can it be seen from ${location.name}?`)}>
      {evenings.map(({ date, hijriDay, month, c }) => (
        <Card key={`${date.year}-${date.month}-${date.day}`} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MoonStar size={20} color={t.colors.primary} />
            <Txt weight="bold" style={{ flex: 1 }}>
              {tr(`مساء ${f.weekday(date)} ${hijriDay} ${hijriMonthName(month, 'ar')}`, `${f.weekday(date)} evening, ${hijriDay} ${hijriMonthName(month, 'en')}`)}
            </Txt>
            {c ? <Badge label={ZONES[c.zone].label} tone={ZONES[c.zone].tone} /> : null}
          </View>
          <Txt muted>{tr(`تحرّي هلال ${nextMonth(month)} · ${f.civil(date)}`, `Looking for the crescent of ${nextMonth(month)} · ${f.civil(date)}`)}</Txt>
          {c ? (
            <View style={{ gap: 4 }}>
              <Txt>{tr(`غروب الشمس ${f.time(c.sunset, tz)}${c.moonset ? ` · غروب القمر ${f.time(c.moonset, tz)}` : ''}`, `Sunset ${f.time(c.sunset, tz)}${c.moonset ? ` · moonset ${f.time(c.moonset, tz)}` : ''}`)}</Txt>
              <Txt muted>
                {c.lagMinutes > 0
                  ? tr(`يمكث القمر بعد الشمس ${Math.round(c.lagMinutes)} دقيقة`, `The moon stays ${Math.round(c.lagMinutes)} minutes after the sun`)
                  : tr('يغرب القمر قبل الشمس', 'The moon sets before the sun')}
              </Txt>
              <Txt muted>
                {c.ageHours > 0
                  ? tr(`عمر الهلال عند الغروب ${Math.floor(c.ageHours)} ساعة ${Math.round((c.ageHours % 1) * 60)} دقيقة · ارتفاعه ${c.altitude.toFixed(1)}° · بُعده عن الشمس ${c.elongation.toFixed(1)}°`, `Age at sunset ${Math.floor(c.ageHours)} h ${Math.round((c.ageHours % 1) * 60)} min · altitude ${c.altitude.toFixed(1)}° · elongation ${c.elongation.toFixed(1)}°`)
                  : tr(`لم يحدث الاقتران بعد (يحدث ${f.weekday(civilDateIn(c.conjunction, tz))} ${f.time(c.conjunction, tz)})`, `Conjunction not yet (at ${f.time(c.conjunction, tz)})`)}
              </Txt>
            </View>
          ) : null}
        </Card>
      ))}
      <Button title={tr('دعاء رؤية الهلال', 'The dua on seeing the crescent')} tone="soft" onPress={() => router.push({ pathname: '/adhkar/[id]', params: { id: DUA_CHAPTER } })} />
      <Evidence id={SIGHTING_HADITH} />
      <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
        {tr(
          'تقدير فلكي لإمكان الرؤية بمعيار عودة (2004) عند أفضل وقت للرصد. العبرة بالرؤية الشرعية وبإعلان الجهات المختصة في بلدك.',
          'An astronomical estimate (Odeh 2004 criterion, at the best time to look). The sighting and your country’s official announcement decide.',
        )}
      </Txt>
    </Screen>
  );
}
