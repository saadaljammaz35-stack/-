// «تعامد الشمس على الكعبة»: twice a year the sun stands straight over the Kaaba, and twice over the
// point opposite it; wherever the sun is up at that moment, it points exactly to (or away from) the qibla.
import { router } from 'expo-router';
import { MapPin, Sun } from 'lucide-react-native';
import { View } from 'react-native';

import { Countdown } from '@/components/countdown';
import { Screen } from '@/components/screen';
import { Button, Card, Group, SwitchRow, Txt } from '@/components/ui';
import { useNow } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { toHijri } from '@/lib/hijri';
import { angleDelta, qiblaBearing } from '@/lib/qibla';
import { kaabaTransits } from '@/lib/sky-events';
import { sunPosition } from '@/lib/sun';
import { civilDateIn } from '@/lib/time';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

const MAKKAH_TZ = 'Asia/Riyadh';

export default function KaabaSun() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const location = useSettings((s) => s.location);
  const offset = useSettings((s) => s.prayer.hijriOffset);
  const sky = useSettings((s) => s.notifications.sky);
  const setNotifications = useSettings((s) => s.setNotifications);
  const now = useNow(60_000);

  if (!location) {
    return (
      <Screen title={tr('الشمس فوق الكعبة', 'The sun over the Kaaba')}>
        <Button title={tr('حدّد موقعك أولًا', 'Set your location first')} icon={MapPin} onPress={() => router.push('/location')} />
      </Screen>
    );
  }
  const list = kaabaTransits(now, 420).filter((e) => e.at.getTime() > now.getTime()).slice(0, 4);
  const next = list[0];
  const tz = location.timezone;
  const day = (d: Date) => {
    const c = civilDateIn(d, tz);
    return `${f.weekday(c)} ${f.civil(c)} · ${f.hijri(toHijri(c, offset))}`;
  };
  const here = next ? sunPosition(next.at, location.lat, location.lng) : null;
  const qibla = qiblaBearing(location.lat, location.lng);
  // Facing the sun (over the Kaaba) or turning one's back to it (over the antipode).
  const pointing = here ? (next.kind === 'kaaba' ? here.azimuth : (here.azimuth + 180) % 360) : 0;
  const error = Math.abs(angleDelta(pointing, qibla));

  return (
    <Screen title={tr('الشمس فوق الكعبة', 'The sun over the Kaaba')} subtitle={tr('أدق طريقة للتحقق من القبلة بلا أجهزة', 'The surest way to check the qibla without devices')}>
      {next && here ? (
        <Card tone="primary" style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Sun size={22} color={t.colors.highlight} />
            <Txt variant="subheading" color="#FFFFFF" style={{ flex: 1 }}>
              {next.kind === 'kaaba' ? tr('الشمس فوق الكعبة', 'The sun over the Kaaba') : tr('الشمس فوق مقابل الكعبة', 'The sun over the Kaaba’s antipode')}
            </Txt>
          </View>
          <Txt color="rgba(255,255,255,0.9)">{day(next.at)}</Txt>
          <Txt color="#FFFFFF" weight="semibold">
            {tr(`الساعة ${f.time(next.at, tz)} بتوقيتك (${f.time(next.at, MAKKAH_TZ)} بتوقيت مكة)`, `${f.time(next.at, tz)} your time (${f.time(next.at, MAKKAH_TZ)} Makkah)`)}
          </Txt>
          {next.at.getTime() - now.getTime() < 2 * 86_400_000 ? (
            <Countdown target={next.at.getTime()} digits={useSettings.getState().digits} variant="title" color={t.colors.highlight} style={{ fontVariant: ['tabular-nums'] }} />
          ) : (
            <Txt variant="title" color={t.colors.highlight}>
              {tr(`بعد ${Math.ceil((next.at.getTime() - now.getTime()) / 86_400_000)} يومًا`, `In ${Math.ceil((next.at.getTime() - now.getTime()) / 86_400_000)} days`)}
            </Txt>
          )}
          <Txt color="rgba(255,255,255,0.92)" style={{ lineHeight: 26 }}>
            {here.altitude > 2
              ? next.kind === 'kaaba'
                ? tr(`ستكون الشمس ظاهرة في ${location.name} (ارتفاعها ${Math.round(here.altitude)}°). في تلك اللحظة استقبل الشمس: هي القبلة، وكل ظل يشير بعيدًا عنها.`, `The sun will be up in ${location.name} (${Math.round(here.altitude)}°). At that moment face the sun: it is the qibla.`)
                : tr(`ستكون الشمس ظاهرة في ${location.name} (ارتفاعها ${Math.round(here.altitude)}°). في تلك اللحظة اجعل الشمس خلفك: ظلك يشير إلى القبلة.`, `The sun will be up in ${location.name} (${Math.round(here.altitude)}°). At that moment turn your back to the sun: your shadow points to the qibla.`)
              : tr(`ستكون الشمس تحت الأفق في ${location.name} وقتها، فلا تُرى من مدينتك هذه المرة.`, `The sun will be below the horizon in ${location.name} then, so it cannot be used from your city this time.`)}
          </Txt>
          {here.altitude > 2 ? (
            <Txt variant="caption" color="rgba(255,255,255,0.75)">
              {tr(`يوافق اتجاه القبلة المحسوب في التطبيق بفارق ${error.toFixed(1)}°.`, `Agrees with the app’s computed qibla within ${error.toFixed(1)}°.`)}
            </Txt>
          ) : null}
        </Card>
      ) : null}

      <Card padded={false}>
        {list.map((e, i) => (
          <View key={e.at.getTime()} style={{ paddingHorizontal: 14, paddingVertical: 11, gap: 2, borderTopWidth: i ? 1 : 0, borderColor: t.colors.border }}>
            <Txt weight="semibold">{e.kind === 'kaaba' ? tr('فوق الكعبة', 'Over the Kaaba') : tr('فوق مقابل الكعبة', 'Over the antipode')}</Txt>
            <Txt variant="caption" muted>{`${day(e.at)} · ${f.time(e.at, tz)}`}</Txt>
          </View>
        ))}
      </Card>

      <Group>
        <SwitchRow title={tr('نبّهني قبلها بعشر دقائق', 'Remind me ten minutes before')} subtitle={tr('ومع الكسوف والخسوف', 'and for eclipses')} value={sky.enabled} onChange={(v) => setNotifications({ sky: { enabled: v } })} />
      </Group>
      <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
        {tr(
          'تحدث حين يساوي ميل الشمس عرض مكة (21.4° شمالًا)، أواخر مايو ومنتصف يوليو ظهرًا بتوقيت مكة، ومقابلها أواخر نوفمبر ومنتصف يناير ليلًا بتوقيت مكة. محسوبة لموقع الكعبة المشرفة.',
          'It happens when the sun’s declination equals Makkah’s latitude (21.4° N): late May and mid-July at noon in Makkah, and opposite it in late November and mid-January.',
        )}
      </Txt>
    </Screen>
  );
}
