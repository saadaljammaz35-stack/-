import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { GlassSurface, haptic } from './Glass';
import { Icon } from './Icon';
import { useTheme } from './theme';
import { brand, springs } from './tokens';

/**
 * The hero control. A glass ring around a deep emerald core with a gold mic.
 * Idle: still (no ambient looping). Listening: ripples expand outward and the
 * whole orb breathes with the user's voice level.
 */
export function MicOrb({
  size = 168,
  listening,
  level = 0,
  onPress,
  label,
  testID,
}: {
  size?: number;
  listening: boolean;
  /** 0..10 from the recognizer */
  level?: number;
  onPress: () => void;
  label: string;
  testID?: string;
}) {
  const { c, reduceMotion } = useTheme();
  const press = useSharedValue(1);
  const voice = useSharedValue(0);
  const ripple = useSharedValue(0);

  useEffect(() => {
    voice.value = withSpring(Math.min(1, Math.max(0, level) / 8), { dampingRatio: 1, duration: 180 });
  }, [level, voice]);

  useEffect(() => {
    if (listening && !reduceMotion) {
      ripple.value = 0;
      ripple.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
    } else {
      cancelAnimation(ripple);
      ripple.value = withTiming(0, { duration: 250 });
    }
  }, [listening, reduceMotion, ripple]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value * (1 + voice.value * 0.06) }],
  }));

  const core = size * 0.7;
  return (
    <View style={{ width: size * 1.5, height: size * 1.5, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 0.33, 0.66].map((offset) => (
        <Ripple key={offset} progress={ripple} offset={offset} size={size} color={c.accent} active={listening && !reduceMotion} />
      ))}
      <Animated.View style={orbStyle}>
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ busy: listening }}
          onPressIn={() => {
            press.value = withSpring(0.95, springs.press);
          }}
          onPressOut={() => {
            press.value = withSpring(1, springs.momentum);
          }}
          onPress={() => {
            haptic('medium');
            onPress();
          }}
        >
          <GlassSurface weight="thin" radius={size / 2} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <View style={[styles.core, { width: core, height: core, borderRadius: core / 2, boxShadow: `0px 14px 34px rgba(11,41,35,0.45)` }]}>
              <LinearGradient
                colors={listening ? ['#2A7A63', brand.emerald, brand.forest] : [brand.emeraldBright, brand.emerald, brand.forest]}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: core / 2 }]}
              />
              {/* specular highlight */}
              <LinearGradient
                colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 0.6 }}
                style={[StyleSheet.absoluteFill, { borderRadius: core / 2 }]}
              />
              <View style={[StyleSheet.absoluteFill, { borderRadius: core / 2, borderWidth: 1.5, borderColor: 'rgba(197,166,106,0.65)' }]} />
              <View>
                <Icon name="mic" size={Math.round(core * 0.36)} color={brand.goldLight} strokeWidth={2} />
              </View>
            </View>
          </GlassSurface>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function Ripple({ progress, offset, size, color, active }: { progress: SharedValue<number>; offset: number; size: number; color: string; active: boolean }) {
  const style = useAnimatedStyle(() => {
    const p = (progress.value + offset) % 1;
    return {
      opacity: active ? interpolate(p, [0, 0.15, 1], [0, 0.45, 0]) : 0,
      transform: [{ scale: interpolate(p, [0, 1], [0.95, 1.5]) }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: color }} />
    </Animated.View>
  );
}

/** Voice level bars under the orb. Static (level only) when motion is reduced. */
export function VoiceWave({ level, active, bars = 13 }: { level: number; active: boolean; bars?: number }) {
  const { c, reduceMotion } = useTheme();
  const t = useSharedValue(0);
  const lv = useSharedValue(0);

  useEffect(() => {
    lv.value = withSpring(active ? Math.min(1, Math.max(0.08, level / 8)) : 0.06, { dampingRatio: 1, duration: 160 });
  }, [level, active, lv]);

  useEffect(() => {
    if (active && !reduceMotion) {
      t.value = 0;
      t.value = withRepeat(withTiming(Math.PI * 2, { duration: 1100, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(t);
    }
  }, [active, reduceMotion, t]);

  return (
    <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: bars }, (_, i) => (
        <Bar key={i} i={i} n={bars} t={t} level={lv} color={i % 3 === 1 ? c.accent : c.primary} />
      ))}
    </View>
  );
}

function Bar({ i, n, t, level, color }: { i: number; n: number; t: SharedValue<number>; level: SharedValue<number>; color: string }) {
  const center = (n - 1) / 2;
  const envelope = 1 - Math.abs(i - center) / (center + 1);
  const phase = i * 0.9;
  const style = useAnimatedStyle(() => {
    const osc = 0.55 + 0.45 * Math.sin(t.value * 2 + phase);
    return { height: 6 + 40 * level.value * envelope * osc };
  });
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  core: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  wave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 52 },
  bar: { width: 4, borderRadius: 2, opacity: 0.9 },
});
