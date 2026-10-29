// «السماء»: the sun over the Kaaba, eclipses and the crescent, each with its next date.
import { router } from 'expo-router';
import { Moon, MoonStar, Sun } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Card, IconCircle, Txt } from '@/components/ui';
import { useToday } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { kaabaTransits, upcomingEclipses } from '@/lib/sky-events';
import { civilDateIn } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

export default function SkyIndex() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const today = useToday();
  const location = useSettings((s) => s.location);
  const tz = location?.timezone ?? 'UTC';
  const next = useMemo(() => {
    const now = new Date();
    return {
      kaaba: kaabaTransits(now, 400).find((e) => e.at > now),
      eclipse: location ? upcomingEclipses(location.lat, location.lng, now, 6)[0] : undefined,
    };
  }, [location, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = [
    {
      icon: Sun,
      title: tr('الشمس فوق الكعبة', 'The sun over the Kaaba'),
      sub: next.kaaba ? tr(`القادم: ${f.civil(civilDateIn(next.kaaba.at, tz))} ${f.time(next.kaaba.at, tz)}`, `Next: ${f.civil(civilDateIn(next.kaaba.at, tz))} ${f.time(next.kaaba.at, tz)}`) : '',
      route: '/sky/kaaba',
    },
    {
      icon: Moon,
      title: tr('الكسوف والخسوف', 'Eclipses'),
      sub: next.eclipse ? tr(`القادم في مدينتك: ${f.civil(civilDateIn(next.eclipse.peak, tz))}`, `Next in your city: ${f.civil(civilDateIn(next.eclipse.peak, tz))}`) : tr('لا شيء قريب في مدينتك', 'None soon in your city'),
      route: '/sky/eclipses',
    },
    { icon: MoonStar, title: tr('الهلال', 'The crescent'), sub: tr('إمكان رؤيته آخر كل شهر هجري', 'Can it be seen at the end of each month?'), route: '/sky/hilal' },
  ];

  return (
    <Screen title={tr('السماء', 'The sky')} subtitle={tr('آيات الله في الشمس والقمر', 'Signs of Allah in the sun and the moon')}>
      {items.map((it, i) => (
        <Card key={it.route} onPress={() => router.push(it.route as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconCircle icon={it.icon} size={50} tint={t.colors.tints[(i * 2) % 6]} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt weight="semibold">{it.title}</Txt>
            <Txt variant="caption" muted>
              {it.sub}
            </Txt>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
