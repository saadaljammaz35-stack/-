// «السماء الحية»: the top of Home is painted with the real sky colour for this moment in the
// user's city, with the sun (or moon) travelling along an arc between the day's prayers.
import { router } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { Countdown } from '@/components/countdown';
import { Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import type { PrayerInfo } from '@/hooks/time';
import { arcPoint, mixColor, skyAt, type SkyTimes } from '@/lib/sky';
import type { DigitStyle } from '@/lib/time';

const ARC_H = 92;
/** Room above the arc for the marker labels. */
const ARC_TOP = 20;

/** Fixed star field (deterministic so stars do not jump between renders). */
function starField(count: number): { x: number; y: number; r: number; o: number }[] {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: count }, () => ({ x: rnd(), y: rnd() * 0.8, r: 0.5 + rnd() * 1.2, o: 0.45 + rnd() * 0.55 }));
}
const STARS = starField(46);

/** Approximate times used to paint the sky before the user picks a location. */
function fallbackTimes(now: Date): SkyTimes {
  const at = (h: number, m: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
  return { fajr: at(4, 45), sunrise: at(6, 0), dhuhr: at(12, 0), asr: at(15, 20), maghrib: at(17, 45), isha: at(19, 15) };
}

export function SkyHero({
  now,
  info,
  greeting,
  dateLine,
  city,
  nextLabel,
  countdownTarget,
  digits,
  labels,
  footer,
}: {
  now: Date;
  info: PrayerInfo;
  greeting: string;
  dateLine: string;
  city: string | null;
  nextLabel: string | null;
  /** When the next prayer starts (ms); the countdown ticks on its own. */
  countdownTarget: number | null;
  digits: DigitStyle;
  labels: { sunrise: string; dhuhr: string; asr: string; maghrib: string };
  footer?: ReactNode;
}) {
  const { isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [arcW, setArcW] = useState(0);

  // Colours only need to move once a minute.
  const minute = Math.floor(now.getTime() / 60_000);
  const times: SkyTimes = useMemo(() => {
    if (!info) return fallbackTimes(new Date(minute * 60_000));
    const d = info.day.times;
    return { fajr: d.fajr.getTime(), sunrise: d.sunrise.getTime(), dhuhr: d.dhuhr.getTime(), asr: d.asr.getTime(), maghrib: d.maghrib.getTime(), isha: d.isha.getTime() };
  }, [info, minute]);
  const sky = skyAt(now.getTime(), times);

  // Time runs right-to-left in Arabic and left-to-right in English.
  const place = (p: number) => {
    const pt = arcPoint(p, arcW, ARC_H);
    return { x: isRTL ? arcW - pt.x : pt.x, y: pt.y + ARC_TOP };
  };
  const edgeAnchor = (x: number) => (x > arcW / 2 ? 'end' : 'start');
  const dayFraction = (ms: number) => (ms - times.sunrise) / (times.maghrib - times.sunrise);
  const body = place(sky.body.progress);
  const markers = sky.body.kind === 'sun' ? [{ p: dayFraction(times.dhuhr), label: labels.dhuhr }, { p: dayFraction(times.asr), label: labels.asr }] : [];

  const shadow = { textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: sky.bright ? 6 : 2, textShadowOffset: { width: 0, height: 1 } };
  const arcPath = arcW
    ? `M ${place(0).x} ${place(0).y} ${Array.from({ length: 40 }, (_, i) => {
        const q = place((i + 1) / 40);
        return `L ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
      }).join(' ')}`
    : '';

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: 'hidden', backgroundColor: sky.top }}>
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={sky.top} />
              <Stop offset="1" stopColor={sky.bottom} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.w} height={size.h} fill="url(#sky)" />
          {sky.stars > 0.02
            ? STARS.map((s, i) => <Circle key={i} cx={s.x * size.w} cy={s.y * size.h} r={s.r} fill="#FFFFFF" opacity={s.o * sky.stars} />)
            : null}
        </Svg>
      ) : null}

      <View style={{ paddingTop: insets.top + 84, paddingHorizontal: 22, paddingBottom: 22, gap: 6 }}>
        <Txt variant="title" weight="bold" color="#FFFFFF" style={shadow}>
          {greeting}
        </Txt>
        <Txt variant="caption" color="rgba(255,255,255,0.88)" style={shadow}>
          {dateLine}
        </Txt>
        {city ? (
          <Pressable onPress={() => router.push('/location')} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 2 }}>
            <MapPin size={14} color="rgba(255,255,255,0.9)" />
            <Txt variant="caption" color="rgba(255,255,255,0.9)" style={shadow}>
              {city}
            </Txt>
          </Pressable>
        ) : null}

        {nextLabel && countdownTarget ? (
          <Pressable onPress={() => router.push('/prayer')} style={{ marginTop: 14 }}>
            <Txt variant="caption" weight="semibold" color="rgba(255,255,255,0.9)" style={shadow}>
              {nextLabel}
            </Txt>
            <Countdown
              target={countdownTarget}
              digits={digits}
              color="#FFFFFF"
              weight="bold"
              style={[{ fontSize: 46, lineHeight: 58, fontVariant: ['tabular-nums'], writingDirection: 'ltr', textAlign: isRTL ? 'right' : 'left' }, shadow]}
            />
          </Pressable>
        ) : null}

        <View onLayout={(e) => setArcW(e.nativeEvent.layout.width)} style={{ height: ARC_TOP + ARC_H + 22, marginTop: 0 }}>
          {arcW > 0 ? (
            <Svg width={arcW} height={ARC_TOP + ARC_H + 22}>
              <Defs>
                <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={sky.body.kind === 'sun' ? '#FFE7A3' : '#FFFFFF'} stopOpacity={sky.body.kind === 'sun' ? 0.9 : 0.5} />
                  <Stop offset="1" stopColor={sky.body.kind === 'sun' ? '#FFE7A3' : '#FFFFFF'} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Path d={arcPath} stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeDasharray="3 6" fill="none" />
              <Path d={`M 0 ${ARC_TOP + ARC_H} L ${arcW} ${ARC_TOP + ARC_H}`} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
              {markers.map((m) => {
                const pt = place(m.p);
                return (
                  <G key={m.label}>
                    <Circle cx={pt.x} cy={pt.y} r={3.5} fill="#FFFFFF" opacity={0.9} />
                    <SvgText x={pt.x} y={pt.y - 10} fill="#FFFFFF" fontSize={11} fontWeight="600" textAnchor="middle" opacity={0.95}>
                      {m.label}
                    </SvgText>
                  </G>
                );
              })}
              {sky.body.kind === 'sun' ? (
                <G>
                  <SvgText x={place(0).x} y={ARC_TOP + ARC_H + 17} fill="#FFFFFF" fontSize={11} textAnchor={edgeAnchor(place(0).x)} opacity={0.85}>
                    {labels.sunrise}
                  </SvgText>
                  <SvgText x={place(1).x} y={ARC_TOP + ARC_H + 17} fill="#FFFFFF" fontSize={11} textAnchor={edgeAnchor(place(1).x)} opacity={0.85}>
                    {labels.maghrib}
                  </SvgText>
                </G>
              ) : null}
              <Circle cx={body.x} cy={body.y} r={26} fill="url(#glow)" />
              {sky.body.kind === 'sun' ? (
                <Circle cx={body.x} cy={body.y} r={9} fill="#FFD25E" />
              ) : (
                <G>
                  <Circle cx={body.x} cy={body.y} r={9} fill="#F4F1E4" />
                  <Circle cx={body.x + (isRTL ? -4 : 4)} cy={body.y - 3} r={8} fill={mixColor(sky.top, sky.bottom, 0.7)} />
                </G>
              )}
            </Svg>
          ) : null}
        </View>
        {footer}
      </View>
    </View>
  );
}
