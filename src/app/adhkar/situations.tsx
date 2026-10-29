// «أذكار المواقف»: the dhikr for a place or a moment, one tap away; and, if allowed, the weather
// where the user is, to bring up the dua for rain, thunder or wind as it happens.
import { router } from 'expo-router';
import {
  Bird,
  Building,
  Car,
  Cloud,
  CloudDrizzle,
  CloudLightning,
  CloudRain,
  DoorOpen,
  Droplets,
  Eye,
  Flame,
  Flower,
  Footprints,
  HeartPulse,
  House,
  Landmark,
  LogOut,
  Moon,
  Plane,
  Shield,
  ShoppingBag,
  Smile,
  Sparkles,
  Stethoscope,
  Users,
  Wind,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Group, IconCircle, SwitchRow, Tap, Txt } from '@/components/ui';
import { refreshWeather, useWeather } from '@/features/weather';
import { useI18n } from '@/i18n';
import { PLACES, STATES, type Situation } from '@/lib/situations';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const ICONS: Record<string, LucideIcon> = {
  'door-open': DoorOpen,
  house: House,
  footprints: Footprints,
  landmark: Landmark,
  'log-out': LogOut,
  'shopping-bag': ShoppingBag,
  droplets: Droplets,
  car: Car,
  plane: Plane,
  building: Building,
  flower: Flower,
  'cloud-rain': CloudRain,
  wind: Wind,
  'cloud-lightning': CloudLightning,
  moon: Moon,
  flame: Flame,
  cloud: Cloud,
  shield: Shield,
  'heart-pulse': HeartPulse,
  stethoscope: Stethoscope,
  'cloud-drizzle': CloudDrizzle,
  smile: Smile,
  bird: Bird,
  sparkles: Sparkles,
  users: Users,
  eye: Eye,
};

const open = (id: string) => router.push({ pathname: '/adhkar/[id]', params: { id: `situation:${id}` } });

function Grid({ items }: { items: Situation[] }) {
  const t = useTheme();
  const { tr } = useI18n();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 }}>
      {items.map((s, i) => (
        <Tap key={s.id} onPress={() => open(s.id)} style={{ width: '33.3%', alignItems: 'center', gap: 6 }} accessibilityLabel={tr(s.ar, s.en)}>
          <IconCircle icon={ICONS[s.icon] ?? Sparkles} size={58} tint={t.colors.tints[i % 6]} iconSize={24} />
          <Txt variant="label" center numberOfLines={2} style={{ paddingHorizontal: 4 }}>
            {tr(s.ar, s.en)}
          </Txt>
        </Tap>
      ))}
    </View>
  );
}

export default function SituationsScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const enabled = useSettings((s) => s.weatherAdhkar);
  const location = useSettings((s) => s.location);
  const set = useSettings((s) => s.set);
  const weather = useWeather((s) => s.weather);
  useEffect(() => {
    if (enabled) refreshWeather();
  }, [enabled, location]);
  const now = enabled && weather ? (weather.thunder ? 'thunder' : weather.rain ? 'rain' : weather.wind ? 'wind' : null) : null;

  return (
    <Screen title={tr('أذكار المواقف', 'Adhkar for the moment')} subtitle={tr('ذكر كل مكان وحال من حصن المسلم', 'For each place and moment, from Hisn al-Muslim')}>
      {now ? (
        <Card tone="primary" style={{ gap: 8 }}>
          <Txt variant="subheading" color="#FFFFFF">
            {tr(`${{ thunder: 'رعد', rain: 'مطر', wind: 'ريح' }[now]} في ${location?.name ?? ''} الآن`, `${{ thunder: 'Thunder', rain: 'Rain', wind: 'Wind' }[now]} in ${location?.name ?? ''} now`)}
          </Txt>
          <Button title={tr('دعاؤه', 'Its dua')} tone="soft" onPress={() => open(now)} />
        </Card>
      ) : null}
      <Group>
        <SwitchRow
          title={tr('أذكار المطر والريح تلقائيًا', 'Rain and wind adhkar automatically')}
          subtitle={
            enabled && !now
              ? weather
                ? tr(`لا مطر ولا ريح في ${location?.name ?? ''} الآن.`, `No rain or wind in ${location?.name ?? ''} now.`)
                : tr('جارٍ معرفة الطقس…', 'Checking the weather…')
              : tr('يُرسل موقع تقريبي (نحو 1 كم) إلى خدمة الطقس النرويجية MET Norway دون أي معرّف.', 'An approximate position (about 1 km) is sent to MET Norway’s weather service, with no identifier.')
          }
          value={enabled}
          onChange={(v) => set({ weatherAdhkar: v })}
        />
      </Group>

      <Txt variant="subheading" weight="bold" color={t.colors.primaryDeep}>
        {tr('في المكان', 'Places')}
      </Txt>
      <Grid items={PLACES} />
      <Txt variant="subheading" weight="bold" color={t.colors.primaryDeep} style={{ marginTop: 8 }}>
        {tr('في الأحوال', 'Moments')}
      </Txt>
      <Grid items={STATES} />
      <Txt variant="caption" muted center>
        {tr('ويذكّرك التطبيق بدعاء رؤية الهلال مساء أول كل شهر هجري، وبدعاء السفر حين يلاحظ أنك ابتعدت عن مدينتك.', 'The app also reminds you of the new-moon dua each Hijri month, and the travel dua when it notices you have left your town.')}
      </Txt>
    </Screen>
  );
}
