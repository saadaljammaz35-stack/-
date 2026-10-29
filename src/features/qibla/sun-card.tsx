// «القبلة بالشمس»: the qibla without a compass. Face the sun, then turn by the angle shown (also
// given on a clock face, so it can be judged by eye).
import { Sun } from 'lucide-react-native';
import { View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { Card, Txt } from '@/components/ui';
import { useNow } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { nextReadableSun, sunQibla } from '@/lib/sun';
import type { PlaceLocation } from '@/lib/prayer-times';
import { useTheme } from '@/theme';

const SIZE = 112;
const SUN = '#F2B33D';

/** You in the middle, the sun straight ahead, the Kaaba `turn` degrees clockwise from it. */
function SunDiagram({ turn }: { turn: number }) {
  const t = useTheme();
  const c = SIZE / 2;
  const r = c - 14;
  const a = (turn * Math.PI) / 180;
  const kx = c + r * Math.sin(a);
  const ky = c - r * Math.cos(a);
  return (
    <Svg width={SIZE} height={SIZE}>
      <Circle cx={c} cy={c} r={r} fill="none" stroke={t.colors.border} strokeWidth={1.5} strokeDasharray="3 4" />
      <Line x1={c} y1={c} x2={c} y2={c - r} stroke={SUN} strokeWidth={2} />
      <Line x1={c} y1={c} x2={kx} y2={ky} stroke={t.colors.primary} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={c} cy={c - r} r={10} fill={SUN} />
      <Rect x={kx - 9} y={ky - 9} width={18} height={18} rx={2} fill="#1C1C1C" />
      <Rect x={kx - 9} y={ky - 5} width={18} height={3} fill="#C9A646" />
      <Circle cx={c} cy={c} r={6} fill={t.colors.primaryDeep} />
    </Svg>
  );
}

export function SunQiblaCard({ location, bearing }: { location: PlaceLocation; bearing: number }) {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const now = useNow(60_000);
  const s = sunQibla(now, location.lat, location.lng, bearing);
  const next = s.kind === 'turn' ? null : nextReadableSun(now, location.lat, location.lng);
  const nextAt = next ? f.time(next, location.timezone) : null;

  let body: string;
  if (s.kind === 'turn') {
    const deg = Math.round(Math.abs(s.turn));
    // On a clock face with the sun at 12, each hour is 30°.
    const hours = Math.max(1, Math.round(deg / 30));
    const hour = s.turn > 0 ? hours : 12 - hours;
    body =
      deg <= 10
        ? tr('القبلة باتجاه الشمس تقريبًا: استقبل الشمس.', 'The qibla is roughly towards the sun: face it.')
        : deg >= 170
          ? tr('القبلة خلفك تقريبًا: اجعل الشمس خلف ظهرك.', 'The qibla is roughly behind you: put the sun at your back.')
          : s.turn > 0
            ? tr(`استقبل الشمس، ثم استدر ${deg}° إلى اليمين (كأن الشمس عند الساعة 12 والقبلة عند الساعة ${hour}).`, `Face the sun, then turn ${deg}° to the right (sun at 12 o'clock, qibla at ${hour}).`)
            : tr(`استقبل الشمس، ثم استدر ${deg}° إلى اليسار (كأن الشمس عند الساعة 12 والقبلة عند الساعة ${hour}).`, `Face the sun, then turn ${deg}° to the left (sun at 12 o'clock, qibla at ${hour}).`);
  } else if (s.kind === 'overhead') {
    body = nextAt
      ? tr(`الشمس فوق رأسك تقريبًا الآن فلا يُعرف اتجاهها بالعين. جرّب بعد ${nextAt}.`, `The sun is almost overhead, so its direction can't be judged. Try after ${nextAt}.`)
      : tr('الشمس فوق رأسك تقريبًا الآن فلا يُعرف اتجاهها بالعين.', 'The sun is almost overhead, so its direction can’t be judged.');
  } else {
    body = nextAt ? tr(`الشمس غائبة الآن. تعمل هذه الطريقة بعد الشروق (${nextAt}).`, `The sun is down. This works again after sunrise (${nextAt}).`) : tr('الشمس غائبة الآن.', 'The sun is down.');
  }

  return (
    <Card style={{ alignSelf: 'stretch', gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Sun size={20} color={SUN} />
        <Txt weight="bold" color={t.colors.primaryDeep} style={{ flex: 1 }}>
          {tr('القبلة بالشمس، بلا بوصلة', 'Qibla by the sun, no compass')}
        </Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {s.kind === 'turn' ? <SunDiagram turn={s.turn} /> : null}
        <Txt style={{ flex: 1, lineHeight: 24 }}>{body}</Txt>
      </View>
      <Txt variant="caption" muted>
        {tr('محسوبة من موقع الشمس لموقعك ووقتك الآن. دقتها بقدر تقديرك للزاوية؛ البوصلة المعايَرة أدق.', 'Computed from the sun’s position for your place and time. It is as precise as your estimate of the angle; a calibrated compass is more precise.')}
      </Txt>
    </Card>
  );
}
