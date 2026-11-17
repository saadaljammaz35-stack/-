import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useApp } from '@/state/appStore';

import { Icon, type IconName } from './Icon';
import { textEnd, textStart } from './rtl';
import { useTheme } from './theme';
import { fonts, radius as R, space, springs, type, type TypeVariant } from './tokens';

const liquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

export function haptic(kind: 'light' | 'medium' | 'success' | 'warning' = 'light') {
  if (Platform.OS === 'web' || !useApp.getState().settings.haptics) return;
  if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === 'warning') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else void Haptics.impactAsync(kind === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
}

// ---------------------------------------------------------------------------
// Ambient background: a soft, static light field. No looping motion.
// ---------------------------------------------------------------------------
export function AmbientBackground() {
  const { c } = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={c.bg} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="ga" cx="85%" cy="8%" rx="70%" ry="45%">
            <Stop offset="0" stopColor={c.glowA} stopOpacity={1} />
            <Stop offset="1" stopColor={c.glowA} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="gb" cx="10%" cy="78%" rx="75%" ry="40%">
            <Stop offset="0" stopColor={c.glowB} stopOpacity={1} />
            <Stop offset="1" stopColor={c.glowB} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#ga)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#gb)" />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Glass material. Weight encodes hierarchy: thin for chips, regular for cards,
// thick for floating chrome (tab bar, sheets). Never stack light glass on glass.
//   iOS 26+: native Liquid Glass.  iOS < 26 and web: live blur.
//   Android: no runtime blur (keeps mid-range phones fast): translucent fill + sheen.
//   Reduced transparency: solid surface with a defined edge.
// ---------------------------------------------------------------------------
type Weight = 'thin' | 'regular' | 'thick';
const BLUR: Record<Weight, number> = { thin: 20, regular: 36, thick: 60 };
const SHADOW: Record<Weight, string> = {
  thin: '0px 2px 10px',
  regular: '0px 10px 30px',
  thick: '0px 18px 44px',
};

export function GlassSurface({
  weight = 'regular',
  radius = R.lg,
  style,
  children,
  interactive,
  shadow = true,
  testID,
}: {
  weight?: Weight;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  interactive?: boolean;
  shadow?: boolean;
  testID?: string;
}) {
  const { c, reduceTransparency, isDark } = useTheme();
  const shadowStyle = shadow ? { boxShadow: `${SHADOW[weight]} ${c.shadow}` } : null;

  if (reduceTransparency) {
    return (
      <View testID={testID} style={[{ borderRadius: radius, backgroundColor: c.solid, borderWidth: 1, borderColor: c.hairline }, shadowStyle, style]}>
        {children}
      </View>
    );
  }

  if (liquidGlass) {
    return (
      <GlassView
        testID={testID}
        glassEffectStyle={weight === 'thin' ? 'clear' : 'regular'}
        tintColor={weight === 'thick' ? c.glass.regular : undefined}
        colorScheme={isDark ? 'dark' : 'light'}
        isInteractive={interactive}
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
      >
        {children}
      </GlassView>
    );
  }

  const blur = Platform.OS === 'ios' || Platform.OS === 'web';
  // zIndex: decoration layers sit below the content on every platform (on the web,
  // absolutely positioned layers would otherwise paint above static children).
  return (
    <View testID={testID} style={[{ borderRadius: radius, zIndex: 0 }, shadowStyle, style]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', zIndex: -1 }]} pointerEvents="none">
        {blur ? <BlurView intensity={BLUR[weight]} tint={c.blurTint} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} /> : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: blur ? c.glass[weight] : c.glass.thick }]} />
        {/* sheen: light catching the top of the material */}
        <LinearGradient
          colors={[isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.55 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, zIndex: -1 }]}
      />
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Press feedback starts on touch-down with a critically damped spring.
// ---------------------------------------------------------------------------
function usePressScale(scaleTo = 0.97) {
  const s = useSharedValue(1);
  const { reduceMotion } = useTheme();
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return {
    style,
    onPressIn: () => {
      if (!reduceMotion) s.set(withSpring(scaleTo, springs.press));
    },
    onPressOut: () => {
      s.set(withSpring(1, springs.standard));
    },
  };
}

export function GlassCard({
  children,
  onPress,
  style,
  weight = 'regular',
  radius = R.lg,
  padding = space.md,
  accessibilityLabel,
  testID,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  weight?: Weight;
  radius?: number;
  padding?: number;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const press = usePressScale(0.98);
  const surface = (
    <GlassSurface weight={weight} radius={radius} style={[{ padding }, !onPress && style]} interactive={Boolean(onPress)} testID={onPress ? undefined : testID}>
      {children}
    </GlassSurface>
  );
  if (!onPress) return surface;
  return (
    <Animated.View style={[press.style, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {surface}
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------
export function Txt({
  children,
  variant = 'body',
  color,
  align = 'start',
  style,
  numberOfLines,
  tone = 'primary',
  selectable,
  testID,
}: {
  children: ReactNode;
  variant?: TypeVariant;
  color?: string;
  align?: 'start' | 'center' | 'end';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  tone?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'danger';
  selectable?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();
  const toneColor = {
    primary: c.text,
    secondary: c.textSecondary,
    tertiary: c.textTertiary,
    accent: c.accentText,
    danger: c.danger,
  }[tone];
  return (
    <Text
      testID={testID}
      selectable={selectable}
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={1.6}
      style={[
        type[variant],
        { color: color ?? toneColor, textAlign: align === 'center' ? 'center' : align === 'end' ? textEnd : textStart },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  loading,
  disabled,
  style,
  testID,
  size = 'md',
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'glass' | 'ghost' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  size?: 'md' | 'lg';
}) {
  const { c } = useTheme();
  const press = usePressScale(0.97);
  const height = size === 'lg' ? 58 : 50;
  const fg = kind === 'primary' ? c.onPrimary : kind === 'danger' ? c.danger : c.text;
  const content = (
    <View style={[styles.btnRow, { height }]}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <Text style={[type.callout, { color: fg, fontFamily: fonts.semibold }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
  const body =
    kind === 'primary' ? (
      <View style={[styles.btnFill, { borderRadius: R.pill, backgroundColor: c.primary, boxShadow: `0px 8px 22px ${c.shadow}` }]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          style={[StyleSheet.absoluteFill, { borderRadius: R.pill }]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          pointerEvents="none"
        />
        {content}
      </View>
    ) : kind === 'glass' ? (
      <GlassSurface weight="regular" radius={R.pill} interactive>
        {content}
      </GlassSurface>
    ) : (
      <View style={[styles.btnFill, { borderRadius: R.pill }]}>{content}</View>
    );
  return (
    <Animated.View style={[press.style, { opacity: disabled ? 0.45 : 1 }, style]}>
      <Pressable
        testID={testID}
        disabled={disabled || loading}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          if (kind === 'primary') haptic('light');
          onPress();
        }}
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
        accessibilityLabel={title}
      >
        {body}
      </Pressable>
    </Animated.View>
  );
}

export function IconButton({
  name,
  onPress,
  label,
  size = 44,
  tint,
  testID,
  glass = true,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  tint?: string;
  testID?: string;
  glass?: boolean;
}) {
  const { c } = useTheme();
  const press = usePressScale(0.92);
  const icon = <Icon name={name} size={Math.round(size * 0.48)} color={tint ?? c.text} />;
  return (
    <Animated.View style={press.style}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
      >
        {glass ? (
          <GlassSurface weight="thin" radius={size / 2} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </GlassSurface>
        ) : (
          <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  swatch,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  swatch?: string;
  testID?: string;
}) {
  const { c } = useTheme();
  const press = usePressScale(0.95);
  return (
    <Animated.View style={press.style}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityState={{ selected: Boolean(selected) }}
        accessibilityLabel={label}
        style={[
          styles.chip,
          selected
            ? { backgroundColor: c.primary, borderColor: c.primary }
            : { backgroundColor: c.glass.thin, borderColor: c.border },
        ]}
      >
        {swatch ? <View style={[styles.swatch, { backgroundColor: swatch, borderColor: c.hairline }]} /> : null}
        {icon ? <Icon name={icon} size={16} color={selected ? c.onPrimary : c.textSecondary} /> : null}
        <Text style={[type.caption, { fontFamily: fonts.medium, color: selected ? c.onPrimary : c.text }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export const Field = forwardRef<React.ComponentRef<typeof TextInput>, TextInputProps & { label?: string; icon?: IconName; hint?: string; error?: string | null }>(
  function Field({ label, icon, hint, error, style, ...props }, ref) {
    const { c } = useTheme();
    return (
      <View style={{ gap: 6 }}>
        {label ? (
          <Txt variant="caption" tone="secondary" style={{ fontFamily: fonts.medium }}>
            {label}
          </Txt>
        ) : null}
        <GlassSurface weight="thin" radius={R.md} shadow={false} style={[styles.field, error ? { borderColor: c.danger, borderWidth: 1 } : null]}>
          {icon ? <Icon name={icon} size={20} color={c.textSecondary} /> : null}
          <TextInput
            ref={ref}
            placeholderTextColor={c.textTertiary}
            selectionColor={c.accent}
            style={[type.body, { flex: 1, color: c.text, textAlign: textStart, paddingVertical: 12 }, style]}
            {...props}
          />
        </GlassSurface>
        {error ? (
          <Txt variant="caption" tone="danger">
            {error}
          </Txt>
        ) : hint ? (
          <Txt variant="caption" tone="tertiary">
            {hint}
          </Txt>
        ) : null}
      </View>
    );
  },
);

export function Row({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
  testID,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  testID?: string;
}) {
  const { c } = useTheme();
  const inner = (
    <View style={styles.row}>
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: danger ? 'rgba(179,38,30,0.10)' : c.glass.thin, borderColor: c.hairline }]}>
          <Icon name={icon} size={20} color={danger ? c.danger : c.text} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyStrong" tone={danger ? 'danger' : 'primary'}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" tone="secondary">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron" size={18} color={c.textTertiary} /> : null)}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title} testID={testID} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {inner}
    </Pressable>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginVertical: 2 }} />;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitle}>
      <Txt variant="headline" style={{ flex: 1 }}>
        {title}
      </Txt>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Txt variant="caption" tone="accent" style={{ fontFamily: fonts.semibold }}>
            {action}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Banner({ text, tone = 'info', icon = 'sparkle', action, onAction }: { text: string; tone?: 'info' | 'warning' | 'danger' | 'success'; icon?: IconName; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  const color = { info: c.accentText, warning: c.warning, danger: c.danger, success: c.success }[tone];
  return (
    <GlassSurface weight="thin" radius={R.md} shadow={false} style={styles.banner}>
      <Icon name={icon} size={18} color={color} />
      <Txt variant="caption" style={{ flex: 1 }} tone="secondary">
        {text}
      </Txt>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Txt variant="caption" style={{ fontFamily: fonts.semibold }} color={color}>
            {action}
          </Txt>
        </Pressable>
      ) : null}
    </GlassSurface>
  );
}

export function EmptyState({ icon, title, body, action, onAction }: { icon: IconName; title: string; body: string; action?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <GlassCard style={{ alignItems: 'center' }} padding={space.xl}>
      <View style={{ alignItems: 'center', gap: space.sm }}>
        <View style={[styles.emptyIcon, { backgroundColor: c.glass.thin, borderColor: c.border }]}>
          <Icon name={icon} size={30} color={c.accentText} />
        </View>
        <Txt variant="headline" align="center">
          {title}
        </Txt>
        <Txt variant="callout" tone="secondary" align="center">
          {body}
        </Txt>
        {action && onAction ? <Button title={action} onPress={onAction} icon="plus" style={{ marginTop: space.xs }} /> : null}
      </View>
    </GlassCard>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <GlassSurface weight="thin" radius={R.pill} shadow={false} style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && { backgroundColor: c.primary }]}
          >
            <Text style={[type.caption, { fontFamily: fonts.semibold, color: active ? c.onPrimary : c.textSecondary }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 22 },
  btnFill: { overflow: 'hidden' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: R.pill,
    borderWidth: 1,
  },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 52 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, minHeight: 56 },
  rowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', marginTop: space.lg, marginBottom: space.sm },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  segmented: { flexDirection: 'row', padding: 4, gap: 4 },
  segment: { flex: 1, height: 36, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center' },
});
