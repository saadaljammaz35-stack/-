// Brand marks drawn as vectors: the eight-petal star from the «مع الله» logo.
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Polygon } from 'react-native-svg';

import { useTheme } from '@/theme';

const B = 50;
const W = B * (Math.SQRT2 - 1);
const PETAL: [number, number][] = [
  [0, -100],
  [W, -100 + W],
  [W, -B],
  [0, -B + W],
  [-W, -B],
  [-W, -100 + W],
];

function petal(angle: number): string {
  const a = (angle * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return PETAL.map(([x, y]) => `${(x * c - y * s).toFixed(2)},${(x * s + y * c).toFixed(2)}`).join(' ');
}
const PETALS = Array.from({ length: 8 }, (_, k) => petal(k * 45));

export function StarMark({ size = 48, color, fill, strokeWidth = 6 }: { size?: number; color?: string; fill?: string; strokeWidth?: number }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size} viewBox="-105 -105 210 210">
      {fill !== 'none' ? <Circle r={38} fill={fill ?? t.colors.primarySoft} /> : null}
      <G fill="none" stroke={color ?? t.colors.primary} strokeWidth={strokeWidth} strokeLinejoin="miter">
        {PETALS.map((p, i) => (
          <Polygon key={i} points={p} />
        ))}
      </G>
    </Svg>
  );
}

/** Faint oversized stars behind the large headers. */
export function StarPattern() {
  const t = useTheme();
  const color = t.colors.scheme === 'dark' ? 'rgba(168,194,155,0.07)' : 'rgba(90,110,81,0.07)';
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', height: 340 }]}>
      <View style={{ position: 'absolute', top: -120, left: -90 }}>
        <StarMark size={360} color={color} fill="none" strokeWidth={3} />
      </View>
      <View style={{ position: 'absolute', top: 40, right: -150 }}>
        <StarMark size={300} color={color} fill="none" strokeWidth={3} />
      </View>
    </View>
  );
}

export function Wordmark({ height = 44, light }: { height?: number; light?: boolean }) {
  return (
    <Image
      source={light ? require('../../assets/brand/wordmark-light.png') : require('../../assets/brand/wordmark.png')}
      style={{ height, width: (height * 430) / 250 }}
      contentFit="contain"
      accessibilityLabel="مع الله"
    />
  );
}
