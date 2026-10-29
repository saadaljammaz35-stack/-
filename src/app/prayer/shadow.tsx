// «ظل العصر»: the shadow of a stick now and through the day, and when it reaches the length at
// which Asr begins.
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { Screen } from '@/components/screen';
import { Button, Card, Txt } from '@/components/ui';
import { Evidence } from '@/features/hadith/evidence';
import { useNow, usePrayerInfo } from '@/hooks/time';
import { useI18n } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { shadowAt } from '@/lib/shadow';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

/** «وقت الظهر إذا زالت الشمس وكان ظل الرجل كطوله … ووقت العصر ما لم تصفر الشمس» (Muslim). */
const TIMES_HADITH = 10596;
const W = 320;
const H = 150;
const STICK = 70;
const SUN = '#F2B33D';

function ShadowDiagram({ ratio, noon, asr, azimuth, altitude }: { ratio: number | null; noon: number; asr: number; azimuth: number; altitude: number }) {
  const t = useTheme();
  // The shadow falls away from the sun: to the left when the sun is in the east (morning).
  const dir = azimuth < 180 ? -1 : 1;
  const scale = Math.min(STICK, (W / 2 - 20) / Math.max(asr + 0.3, ratio ?? 0, 1));
  const baseX = W / 2;
  const ground = H - 24;
  const len = ratio == null ? 0 : Math.min(W / 2 - 10, ratio * scale);
  const mark = (r: number, color: string) => <Line x1={baseX + dir * r * scale} y1={ground - 8} x2={baseX + dir * r * scale} y2={ground + 8} stroke={color} strokeWidth={2} />;
  return (
    <Svg width={W} height={H}>
      <Line x1={10} y1={ground} x2={W - 10} y2={ground} stroke={t.colors.border} strokeWidth={2} />
      {ratio != null ? <Rect x={dir > 0 ? baseX : baseX - len} y={ground - 3} width={len} height={6} rx={3} fill={t.colors.textMuted} opacity={0.55} /> : null}
      {mark(noon, t.colors.primary)}
      {mark(asr, t.colors.danger)}
      <Line x1={baseX} y1={ground} x2={baseX} y2={ground - scale} stroke={t.colors.primaryDeep} strokeWidth={4} strokeLinecap="round" />
      {ratio != null ? <Circle cx={baseX - dir * Math.cos((altitude * Math.PI) / 180) * (W / 2 - 22)} cy={ground - Math.sin((altitude * Math.PI) / 180) * (ground - 16)} r={11} fill={SUN} /> : null}
    </Svg>
  );
}

export default function ShadowScreen() {
  const t = useTheme();
  const { tr } = useI18n();
  const f = useFormat();
  const location = useSettings((s) => s.location);
  const madhab = useSettings((s) => s.prayer.madhab);
  const now = useNow(60_000);
  const info = usePrayerInfo(now);
  const [offset, setOffset] = useState<number | null>(null);

  if (!location || !info) {
    return (
      <Screen title={tr('ظل العصر', 'The Asr shadow')}>
        <Button title={tr('حدّد موقعك أولًا', 'Set your location first')} icon={MapPin} onPress={() => router.push('/location')} />
      </Screen>
    );
  }
  const { times } = info.day;
  const sunrise = times.sunrise.getTime();
  const sunset = times.maghrib.getTime();
  // The slider runs from sunrise to sunset; untouched, it follows the clock.
  const at = offset == null ? now : new Date(sunrise + offset * (sunset - sunrise));
  const s = shadowAt(at, location.lat, location.lng, madhab);
  const live = offset == null;
  const before = at.getTime() < times.asr.getTime();

  return (
    <Screen title={tr('ظل العصر', 'The Asr shadow')} subtitle={tr('ظل كل شيء بطوله', 'Shadows in units of height')}>
      <Card style={{ alignItems: 'center', gap: 10 }}>
        <ShadowDiagram ratio={s.ratio} noon={s.noon} asr={s.asr} azimuth={s.azimuth} altitude={s.altitude} />
        <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Legend color={t.colors.primary} label={tr('ظل الزوال', 'Noon shadow')} />
          <Legend color={t.colors.danger} label={tr('بداية العصر', 'Asr begins')} />
        </View>
        <Txt variant="title" color={t.colors.primaryDeep}>
          {s.ratio == null ? tr('الشمس غائبة', 'The sun is down') : tr(`الظل ${s.ratio.toFixed(2)} من طول الشيء`, `Shadow: ${s.ratio.toFixed(2)} × height`)}
        </Txt>
        <Txt muted center>
          {`${live ? tr('الآن', 'Now') : ''} ${f.time(at, location.timezone)}`.trim()}
        </Txt>
        <Slider
          style={{ alignSelf: 'stretch', height: 36 }}
          minimumValue={0}
          maximumValue={1}
          value={offset ?? Math.min(1, Math.max(0, (now.getTime() - sunrise) / (sunset - sunrise)))}
          onValueChange={setOffset}
          minimumTrackTintColor={t.colors.primary}
          maximumTrackTintColor={t.colors.border}
          thumbTintColor={SUN}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' }}>
          <Txt variant="caption" muted>{tr(`الشروق ${f.time(times.sunrise, location.timezone)}`, `Sunrise ${f.time(times.sunrise, location.timezone)}`)}</Txt>
          {!live ? (
            <Txt variant="caption" color={t.colors.primary} onPress={() => setOffset(null)}>
              {tr('العودة إلى الآن', 'Back to now')}
            </Txt>
          ) : null}
          <Txt variant="caption" muted>{tr(`المغرب ${f.time(times.maghrib, location.timezone)}`, `Maghrib ${f.time(times.maghrib, location.timezone)}`)}</Txt>
        </View>
      </Card>

      <Card style={{ gap: 8 }}>
        <Txt weight="semibold">
          {tr(`يدخل وقت العصر ${f.time(times.asr, location.timezone)}`, `Asr begins at ${f.time(times.asr, location.timezone)}`)}
        </Txt>
        <Txt muted style={{ lineHeight: 24 }}>
          {madhab === 'hanafi'
            ? tr(`حين يصير ظل الشيء مثلَيه بعد ظل الزوال (${s.noon.toFixed(2)})، أي ${s.asr.toFixed(2)} من طوله، على مذهب الحنفية كما اخترت في الإعدادات.`, `When a shadow is twice the height beyond the noon shadow (${s.noon.toFixed(2)}): ${s.asr.toFixed(2)} × height, the Hanafi reckoning you chose.`)
            : tr(`حين يصير ظل الشيء مثله بعد ظل الزوال (${s.noon.toFixed(2)})، أي ${s.asr.toFixed(2)} من طوله، وهو قول الجمهور.`, `When a shadow equals the height beyond the noon shadow (${s.noon.toFixed(2)}): ${s.asr.toFixed(2)} × height, the majority view.`)}
        </Txt>
        {s.ratio != null ? (
          <Txt color={before ? t.colors.textMuted : t.colors.primary}>
            {before ? tr('لم يدخل وقت العصر بعد في هذه اللحظة.', 'Asr has not begun at this moment.') : tr('دخل وقت العصر في هذه اللحظة.', 'Asr has begun at this moment.')}
          </Txt>
        ) : null}
        <Txt variant="caption" muted>
          {tr('جرّبها بنفسك: اغرز عودًا مستقيمًا في أرض مستوية وقِس ظله بطوله.', 'Try it: stand a straight stick on level ground and measure its shadow against its height.')}
        </Txt>
      </Card>
      <Evidence id={TIMES_HADITH} />
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 3, backgroundColor: color, borderRadius: 2 }} />
      <Txt variant="caption">{label}</Txt>
    </View>
  );
}
