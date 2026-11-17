import { Text, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useTheme } from './theme';
import { brand, fonts } from './tokens';

/** The MAHALLAK mark: a location pin over an "M" folded like a roof, with a window. */
export function LogoMark({ size = 56, mono }: { size?: number; mono?: string }) {
  const legs = mono ?? 'url(#mLegs)';
  const fold = mono ?? 'url(#mFold)';
  const foldAlt = mono ?? 'url(#mFoldAlt)';
  return (
    <Svg width={size} height={size} viewBox="20 20 160 150" accessibilityRole="image" accessibilityLabel="MAHALLAK">
      <Defs>
        <LinearGradient id="mLegs" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={brand.gold} />
          <Stop offset="1" stopColor="#A8884E" />
        </LinearGradient>
        <LinearGradient id="mFold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={brand.goldLight} />
          <Stop offset="1" stopColor={brand.gold} />
        </LinearGradient>
        <LinearGradient id="mFoldAlt" x1="1" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#EAD9AE" />
          <Stop offset="1" stopColor="#CDB077" />
        </LinearGradient>
      </Defs>
      <G>
        <Path d="M30 66 H52 V140 L30 154 Z" fill={legs} />
        <Path d="M170 66 H148 V140 L170 154 Z" fill={legs} />
        <Path d="M30 70 C30 58 41 51 51 57 L103 96 L96 118 L33 72 Z" fill={fold} />
        <Path d="M170 70 C170 58 159 51 149 57 L97 96 L104 118 L167 72 Z" fill={foldAlt} />
        <Path
          fillRule="evenodd"
          fill={fold}
          d="M100 80 C93 70 86 61 86 50 A14 14 0 0 1 114 50 C114 61 107 70 100 80 Z M100 44 A6 6 0 1 0 100 56 A6 6 0 1 0 100 44 Z"
        />
        <Rect x="91" y="129" width="7.5" height="7.5" rx="1.2" fill={fold} />
        <Rect x="101.5" y="129" width="7.5" height="7.5" rx="1.2" fill={fold} />
        <Rect x="91" y="139.5" width="7.5" height="7.5" rx="1.2" fill={fold} />
        <Rect x="101.5" y="139.5" width="7.5" height="7.5" rx="1.2" fill={fold} />
      </G>
    </Svg>
  );
}

/** Mark + Arabic wordmark + Latin wordmark. Tracking only on the Latin line. */
export function Logo({ size = 96, showLatin = true }: { size?: number; showLatin?: boolean }) {
  const { c, isDark } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <LogoMark size={size} />
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.48, lineHeight: size * 0.72, color: isDark ? brand.beige : brand.emerald }}>مَحَلّك</Text>
      {showLatin ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: size * 0.13, letterSpacing: size * 0.06, color: c.accentText, marginTop: -2 }}>MAHALLAK</Text>
      ) : null}
    </View>
  );
}
