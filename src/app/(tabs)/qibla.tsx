import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Info, MapPin, RefreshCw } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';

import { TabScreen } from '@/components/screen';
import { Button, Card, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { angleDelta, compassPoint, distanceToKaabaKm, isAligned, qiblaBearing } from '@/lib/qibla';
import { useSettings } from '@/store/settings';
import { useTheme } from '@/theme';

type Heading = { value: number; accuracy: number } | null;

function useHeading(enabled: boolean): { heading: Heading; error: string | null } {
  const [heading, setHeading] = useState<Heading>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    let sub: Location.LocationSubscription | null = null;
    let smoothed: number | null = null;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) {
        const asked = await Location.requestForegroundPermissionsAsync();
        if (!asked.granted) {
          setError('denied');
          return;
        }
      }
      sub = await Location.watchHeadingAsync((h) => {
        const raw = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
        // Low-pass filter on the circle so the needle does not jitter.
        smoothed = smoothed == null ? raw : (smoothed + angleDelta(smoothed, raw) * 0.25 + 360) % 360;
        setHeading({ value: smoothed, accuracy: h.accuracy });
      });
    })().catch(() => setError('unavailable'));
    return () => sub?.remove();
  }, [enabled]);
  return { heading, error };
}

function Dial({ heading, bearing, aligned }: { heading: number; bearing: number; aligned: boolean }) {
  const t = useTheme();
  const size = 300;
  const c = size / 2;
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  const labels: [number, string][] = [
    [0, 'ش'],
    [90, 'ق'],
    [180, 'ج'],
    [270, 'غ'],
  ];
  return (
    <Svg width={size} height={size}>
      <Circle cx={c} cy={c} r={c - 4} fill={t.colors.surface} stroke={aligned ? t.colors.primary : t.colors.border} strokeWidth={aligned ? 4 : 2} />
      <G rotation={-heading} origin={`${c}, ${c}`}>
        {ticks.map((d) => {
          const long = d % 30 === 0;
          const a = (d * Math.PI) / 180;
          const r1 = c - 10;
          const r2 = c - (long ? 24 : 16);
          return (
            <Line key={d} x1={c + r1 * Math.sin(a)} y1={c - r1 * Math.cos(a)} x2={c + r2 * Math.sin(a)} y2={c - r2 * Math.cos(a)} stroke={long ? t.colors.textMuted : t.colors.border} strokeWidth={long ? 2 : 1} />
          );
        })}
        {labels.map(([d, l]) => {
          const a = (d * Math.PI) / 180;
          const r = c - 40;
          return (
            <SvgText key={l} x={c + r * Math.sin(a)} y={c - r * Math.cos(a) + 6} fontSize={16} fontWeight="bold" fill={d === 0 ? t.colors.danger : t.colors.textMuted} textAnchor="middle">
              {l}
            </SvgText>
          );
        })}
        <G rotation={bearing} origin={`${c}, ${c}`}>
          <Line x1={c} y1={c} x2={c} y2={44} stroke={t.colors.primaryDeep} strokeWidth={5} strokeLinecap="round" />
          <Polygon points={`${c},34 ${c - 12},58 ${c + 12},58`} fill={t.colors.primaryDeep} />
          <Rect x={c - 14} y={8} width={28} height={24} rx={3} fill="#1C1C1C" />
          <Rect x={c - 14} y={13} width={28} height={4} fill="#C9A646" />
        </G>
      </G>
      <Circle cx={c} cy={c} r={10} fill={t.colors.primary} />
      <Path d={`M ${c} 2 L ${c - 8} 18 L ${c + 8} 18 Z`} fill={aligned ? t.colors.primary : t.colors.textMuted} />
    </Svg>
  );
}

export default function QiblaTab() {
  const t = useTheme();
  const { tr } = useI18n();
  const location = useSettings((s) => s.location);
  const haptics = useSettings((s) => s.haptics);
  const { heading, error } = useHeading(Boolean(location));
  const wasAligned = useRef(false);

  const bearing = location ? qiblaBearing(location.lat, location.lng) : 0;
  const km = location ? distanceToKaabaKm(location.lat, location.lng) : 0;
  const aligned = heading ? isAligned(heading.value, bearing, 4) : false;

  useEffect(() => {
    if (aligned && !wasAligned.current && haptics && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
    wasAligned.current = aligned;
  }, [aligned, haptics]);

  if (!location) {
    return (
      <TabScreen title={tr('القبلة', 'Qibla')}>
        <Card style={{ marginHorizontal: 20, gap: 12 }}>
          <Txt>{tr('حدّد موقعك أولًا لحساب اتجاه القبلة.', 'Set your location first to compute the qibla.')}</Txt>
          <Button title={tr('تحديد الموقع', 'Set location')} icon={MapPin} onPress={() => router.push('/location')} />
        </Card>
      </TabScreen>
    );
  }

  const turn = heading ? angleDelta(heading.value, bearing) : 0;
  const needsCalibration = heading != null && heading.accuracy < 2;

  return (
    <TabScreen title={tr('القبلة', 'Qibla')}>
      <View style={{ paddingHorizontal: 20, gap: 18, alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Txt variant="title" color={aligned ? t.colors.primary : t.colors.text}>
            {Platform.OS === 'web'
              ? tr(`${Math.round(bearing)}° من الشمال`, `${Math.round(bearing)}° from north`)
              : !heading
                ? tr('جارٍ قراءة البوصلة…', 'Reading compass…')
                : aligned
                  ? tr('أنت باتجاه القبلة', 'You are facing the qibla')
                  : turn > 0
                    ? tr(`استدر يمينًا ${Math.round(Math.abs(turn))}°`, `Turn right ${Math.round(Math.abs(turn))}°`)
                    : tr(`استدر يسارًا ${Math.round(Math.abs(turn))}°`, `Turn left ${Math.round(Math.abs(turn))}°`)}
          </Txt>
          <Txt muted>{`${location.name} • ${tr('القبلة', 'Qibla')} ${Math.round(bearing)}° (${compassPoint(bearing)})`}</Txt>
        </View>
        <Dial heading={heading?.value ?? 0} bearing={bearing} aligned={aligned} />
        <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
          <Card style={{ flex: 1, alignItems: 'center' }}>
            <Txt variant="caption" muted>
              {tr('المسافة إلى مكة', 'Distance to Makkah')}
            </Txt>
            <Txt variant="heading" color={t.colors.primaryDeep}>
              {tr(`${Math.round(km).toLocaleString('en')} كم`, `${Math.round(km).toLocaleString('en')} km`)}
            </Txt>
          </Card>
          <Card style={{ flex: 1, alignItems: 'center' }}>
            <Txt variant="caption" muted>
              {tr('اتجاه جهازك', 'Your heading')}
            </Txt>
            <Txt variant="heading" color={t.colors.primaryDeep}>
              {heading ? `${Math.round(heading.value)}°` : '—'}
            </Txt>
          </Card>
        </View>
        {Platform.OS === 'web' ? (
          <Card style={{ alignSelf: 'stretch', flexDirection: 'row', gap: 10 }}>
            <Info size={20} color={t.colors.primaryDeep} />
            <Txt style={{ flex: 1 }} muted>
              {tr('البوصلة الحية تعمل في تطبيق الجوال. في المتصفح تُعرض زاوية القبلة من الشمال الجغرافي.', 'The live compass works in the mobile app. The browser shows the bearing from true north.')}
            </Txt>
          </Card>
        ) : null}
        {error ? (
          <Card style={{ alignSelf: 'stretch', gap: 8 }}>
            <Txt color={t.colors.danger}>{error === 'denied' ? tr('البوصلة تحتاج إذن الموقع.', 'The compass needs location permission.') : tr('البوصلة غير متاحة على هذا الجهاز.', 'Compass not available on this device.')}</Txt>
          </Card>
        ) : null}
        {needsCalibration ? (
          <Card style={{ alignSelf: 'stretch', gap: 8, flexDirection: 'row' }}>
            <RefreshCw size={22} color={t.colors.warning} />
            <View style={{ flex: 1 }}>
              <Txt weight="semibold">{tr('معايرة البوصلة', 'Calibrate the compass')}</Txt>
              <Txt variant="caption" muted>
                {tr('حرّك جهازك على شكل الرقم 8 في الهواء عدة مرات، وابتعد عن المعادن والأجهزة المغناطيسية.', 'Move your phone in a figure-8 a few times, away from metal and magnets.')}
              </Txt>
            </View>
          </Card>
        ) : null}
        <Txt variant="caption" muted center>
          {tr('الاتجاه محسوب بالدائرة العظمى نحو الكعبة المشرفة من الشمال الجغرافي، ويُصحَّح انحراف البوصلة المغناطيسي تلقائيًا عند توفره.', 'Great-circle bearing to the Kaaba from true north; magnetic declination is corrected when available.')}
        </Txt>
      </View>
    </TabScreen>
  );
}
