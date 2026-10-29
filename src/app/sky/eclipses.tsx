// «الكسوف والخسوف»: the eclipses that will be seen from the user's city in the coming years, with
// their times, and the Sunnah of the eclipse prayer with its hadiths.
import { router } from 'expo-router';
import { MapPin, Moon, Sun } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Badge, Button, Card, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { toHijri } from '@/lib/hijri';
import { upcomingEclipses } from '@/lib/sky-events';
import { civilDateIn } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const SIGNS_HADITH = 3101; // «إن الشمس والقمر آيتان من آيات الله … فإذا رأيتم منها شيئًا فصلّوا»
const PRAYER_HADITH = 5215; // How he prayed it (Aisha)
const FEAR_HADITH = 3102; // He rose alarmed (Abu Musa)

export default function Eclipses() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const today = useToday();
  const location = useSettings((s) => s.location);
  const offset = useSettings((s) => s.prayer.hijriOffset);
  const list = useMemo(() => (location ? upcomingEclipses(location.lat, location.lng, new Date(), 6) : []), [location, today]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!location) {
    return (
      <Screen title={tr('الكسوف والخسوف', 'Eclipses')}>
        <Button title={tr('حدّد موقعك أولًا', 'Set your location first')} icon={MapPin} onPress={() => router.push('/location')} />
      </Screen>
    );
  }
  const tz = location.timezone;
  const kindLabel = (body: 'sun' | 'moon', kind: string) =>
    body === 'sun'
      ? { total: tr('كسوف كلي', 'Total solar eclipse'), annular: tr('كسوف حلقي', 'Annular solar eclipse'), partial: tr('كسوف جزئي', 'Partial solar eclipse') }[kind]
      : { total: tr('خسوف كلي', 'Total lunar eclipse'), partial: tr('خسوف جزئي', 'Partial lunar eclipse'), annular: '' }[kind];

  return (
    <Screen title={tr('الكسوف والخسوف', 'Eclipses')} subtitle={tr(`ما يُرى منها في ${location.name}`, `Those seen from ${location.name}`)}>
      {list.length ? (
        list.map((e) => {
          const c = civilDateIn(e.peak, tz);
          const Icon = e.body === 'sun' ? Sun : Moon;
          return (
            <Card key={`${e.body}-${e.peak.getTime()}`} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon size={20} color={e.body === 'sun' ? '#E2A23B' : t.colors.primary} />
                <Txt weight="bold" style={{ flex: 1 }}>
                  {kindLabel(e.body, e.kind)}
                </Txt>
                <Badge label={`${Math.round(e.magnitude * 100)}%`} tone={e.kind === 'total' ? 'sahih' : 'soft'} />
              </View>
              <Txt>{`${f.weekday(c)} ${f.civil(c)} · ${f.hijri(toHijri(c, offset))}`}</Txt>
              <Txt muted>
                {tr(`يبدأ ${f.time(e.begin, tz)} · ذروته ${f.time(e.peak, tz)} · ينتهي ${f.time(e.end, tz)}`, `Begins ${f.time(e.begin, tz)} · peak ${f.time(e.peak, tz)} · ends ${f.time(e.end, tz)}`)}
              </Txt>
              {!e.visibleAtPeak ? <Txt variant="caption" color={t.colors.warning}>{tr('يُرى جزء منه فقط قبل الغروب أو بعد الشروق.', 'Only part of it is seen, near sunrise or sunset.')}</Txt> : null}
            </Card>
          );
        })
      ) : (
        <Card>
          <Txt muted>{tr('لا كسوف ولا خسوف يُرى من مدينتك في السنوات القادمة.', 'No eclipse will be seen from your city in the coming years.')}</Txt>
        </Card>
      )}
      <Txt variant="subheading" weight="bold" color={t.colors.primaryDeep} style={{ marginTop: 6 }}>
        {tr('صلاة الكسوف', 'The eclipse prayer')}
      </Txt>
      <Evidence id={SIGNS_HADITH} />
      <Evidence id={PRAYER_HADITH} />
      <Evidence id={FEAR_HADITH} />
      <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
        {tr('الأوقات محسوبة فلكيًا لموقعك. والخسوف شبه الظلي لا يظهر للعين فلم يُذكر.', 'Times are computed for your location. Penumbral lunar eclipses are not visible to the eye and are left out.')}
      </Txt>
    </Screen>
  );
}
