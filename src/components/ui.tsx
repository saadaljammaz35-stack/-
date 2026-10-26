// Shared UI building blocks. Calm surfaces, generous spacing, one accent colour.
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

type Variant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'caption' | 'label';
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

const SIZES: Record<Variant, number> = {
  display: 34,
  title: 26,
  heading: 20,
  subheading: 17,
  body: 15,
  caption: 13,
  label: 12,
};

export function Txt({
  variant = 'body',
  weight,
  color,
  muted,
  center,
  style,
  children,
  ...rest
}: TextProps & {
  variant?: Variant;
  weight?: Weight;
  color?: string;
  muted?: boolean;
  center?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const t = useTheme();
  const w: Weight = weight ?? (variant === 'display' || variant === 'title' ? 'bold' : variant === 'heading' ? 'semibold' : 'regular');
  const size = t.fs(SIZES[variant]);
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: t.fonts[w],
          fontSize: size,
          lineHeight: Math.round(size * 1.55),
          color: color ?? (muted ? t.colors.textMuted : t.colors.text),
          writingDirection: t.isRTL ? 'rtl' : 'ltr',
        },
        center && { textAlign: 'center' },
        style,
      ]}>
      {children}
    </Text>
  );
}

/** Long-form Arabic reading text (adhkar, hadith, tafsir). */
export function ReadingText({ children, size = 20, style, selectable = true }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle>; selectable?: boolean }) {
  const t = useTheme();
  const fs = t.rs(size);
  return (
    <Text
      selectable={selectable}
      style={[{ fontFamily: t.fonts.reading, fontSize: fs, lineHeight: Math.round(fs * 1.9), color: t.colors.text, writingDirection: 'rtl' }, style]}>
      {children}
    </Text>
  );
}

/** Quran text in the King Fahd Complex Hafs script. Verse numbers render as ayah markers. */
export function QuranText({ children, size = 24, style, color }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle>; color?: string }) {
  const t = useTheme();
  return (
    <Text
      selectable
      style={[
        { fontFamily: t.fonts.quran, fontSize: size, lineHeight: Math.round(size * 1.95), color: color ?? t.colors.mushafInk, writingDirection: 'rtl', textAlign: 'center' },
        style,
      ]}>
      {children}
    </Text>
  );
}

export function Card({ children, style, onPress, padded = true, tone = 'surface' }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean; tone?: 'surface' | 'soft' | 'primary' }) {
  const t = useTheme();
  const bg = tone === 'primary' ? t.colors.fill : tone === 'soft' ? t.colors.primarySoft : t.colors.surface;
  const base: ViewStyle = {
    backgroundColor: bg,
    borderRadius: t.radius.lg,
    padding: padded ? t.space.lg : 0,
    borderWidth: tone === 'surface' && t.colors.scheme === 'light' ? StyleSheet.hairlineWidth : 0,
    borderColor: t.colors.border,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }, style]}>
      {children}
    </Pressable>
  );
}

export function Tap({ style, children, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <Pressable {...rest} style={({ pressed }) => [style, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

export function IconCircle({ icon: Icon, size = 56, tint, color, iconSize }: { icon: LucideIcon; size?: number; tint?: string; color?: string; iconSize?: number }) {
  const t = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint ?? t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={iconSize ?? Math.round(size * 0.44)} color={color ?? t.colors.primaryDeep} strokeWidth={1.7} />
    </View>
  );
}

export function IconButton({ icon: Icon, onPress, label, size = 44, tone = 'soft', disabled, color }: { icon: LucideIcon; onPress?: () => void; label: string; size?: number; tone?: 'soft' | 'plain' | 'primary'; disabled?: boolean; color?: string }) {
  const t = useTheme();
  const bg = tone === 'primary' ? t.colors.primary : tone === 'soft' ? t.colors.surface : 'transparent';
  const fg = color ?? (tone === 'primary' ? t.colors.onPrimary : t.colors.primaryDeep);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        borderWidth: tone === 'soft' ? StyleSheet.hairlineWidth : 0,
        borderColor: t.colors.border,
      })}>
      <Icon size={Math.round(size * 0.46)} color={fg} strokeWidth={1.8} />
    </Pressable>
  );
}

export function Button({ title, onPress, icon: Icon, tone = 'primary', disabled, loading, style }: { title: string; onPress?: () => void; icon?: LucideIcon; tone?: 'primary' | 'soft' | 'danger' | 'plain'; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const bg = tone === 'primary' ? t.colors.fill : tone === 'danger' ? t.colors.danger : tone === 'soft' ? t.colors.primarySoft : 'transparent';
  const fg = tone === 'primary' || tone === 'danger' ? '#FFFFFF' : t.colors.primaryDeep;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        { backgroundColor: bg, borderRadius: t.radius.pill, paddingVertical: 13, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : Icon ? <Icon size={18} color={fg} strokeWidth={2} /> : null}
      <Txt weight="semibold" color={fg}>
        {title}
      </Txt>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: t.radius.pill,
        backgroundColor: active ? t.colors.fill : t.colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: active ? t.colors.fill : t.colors.border,
        opacity: pressed ? 0.8 : 1,
      })}>
      <Txt variant="caption" weight="medium" color={active ? '#FFFFFF' : t.colors.text}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.colors.surfaceAlt, borderRadius: t.radius.pill, padding: 4 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, paddingVertical: 9, borderRadius: t.radius.pill, backgroundColor: active ? t.colors.surface : 'transparent', alignItems: 'center' }}>
            <Txt variant="caption" weight={active ? 'semibold' : 'regular'} color={active ? t.colors.primaryDeep : t.colors.textMuted}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ForwardChevron({ size = 18, color }: { size?: number; color?: string }) {
  const t = useTheme();
  const { isRTL } = useI18n();
  const Icon = isRTL ? ChevronLeft : ChevronRight;
  return <Icon size={size} color={color ?? t.colors.textFaint} />;
}

export function Row({
  title,
  subtitle,
  icon,
  onPress,
  right,
  chevron = true,
  danger,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  onPress?: () => void;
  right?: ReactNode;
  chevron?: boolean;
  danger?: boolean;
}) {
  const t = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16 }}>
      {icon ? <IconCircle icon={icon} size={36} tint={danger ? '#F6DEDA' : t.colors.primarySoft} color={danger ? t.colors.danger : t.colors.primaryDeep} /> : null}
      <View style={{ flex: 1 }}>
        <Txt weight="medium" color={danger ? t.colors.danger : undefined}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" muted numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
      {onPress && chevron ? <ForwardChevron /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { backgroundColor: t.colors.surfaceAlt }}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function SwitchRow({ title, subtitle, value, onChange, icon }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; icon?: LucideIcon }) {
  const t = useTheme();
  return (
    <Row
      title={title}
      subtitle={subtitle}
      icon={icon}
      chevron={false}
      right={<Switch value={value} onValueChange={onChange} trackColor={{ true: t.colors.primary, false: t.colors.border }} thumbColor="#FFFFFF" />}
    />
  );
}

export function Group({ children, title, style }: { children: ReactNode; title?: string; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View style={[{ gap: 8 }, style]}>
      {title ? (
        <Txt variant="caption" weight="semibold" muted style={{ paddingHorizontal: 6 }}>
          {title}
        </Txt>
      ) : null}
      <View style={{ backgroundColor: t.colors.surface, borderRadius: t.radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border }}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border, marginStart: 16 }} /> : null}
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <Txt variant="heading" weight="bold" color={t.colors.primaryDeep}>
        {title}
      </Txt>
      {action ? (
        <Tap onPress={onAction} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Txt variant="caption" muted>
            {action}
          </Txt>
          <ForwardChevron size={16} />
        </Tap>
      ) : null}
    </View>
  );
}

export function ProgressBar({ value, height = 6, color }: { value: number; height?: number; color?: string }) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: t.colors.primarySoft, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height, backgroundColor: color ?? t.colors.primary }} />
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={{ padding: 40, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={t.colors.primary} />
      {label ? <Txt muted>{label}</Txt> : null}
    </View>
  );
}

export function EmptyState({ icon, title, message, action, onAction }: { icon: LucideIcon; title: string; message?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ padding: 32, alignItems: 'center', gap: 10 }}>
      <IconCircle icon={icon} size={64} />
      <Txt variant="subheading" weight="semibold" center>
        {title}
      </Txt>
      {message ? (
        <Txt muted center>
          {message}
        </Txt>
      ) : null}
      {action ? <Button title={action} onPress={onAction} tone="soft" style={{ marginTop: 6 }} /> : null}
    </View>
  );
}

export function Badge({ label, tone = 'soft' }: { label: string; tone?: 'soft' | 'sahih' | 'hasan' | 'daif' | 'other' }) {
  const t = useTheme();
  const colors: Record<string, [string, string]> = {
    soft: [t.colors.primarySoft, t.colors.primaryDeep],
    sahih: ['#DDEFD8', '#2F6B2A'],
    hasan: ['#EEF0D2', '#6A6420'],
    daif: ['#F6DEDA', '#9A3A28'],
    other: [t.colors.surfaceAlt, t.colors.textMuted],
  };
  const [bg, fg] = colors[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: t.radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Txt variant="label" weight="semibold" color={fg}>
        {label}
      </Txt>
    </View>
  );
}
