/**
 * Shared UI primitives.
 *
 * Extracted because the same button, card and row appeared in every screen and
 * were drifting apart — one had a 44pt touch target and another did not. In a
 * banking app a mis-tap moves money, so the minimum target is enforced here
 * once rather than remembered five times.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import {
  MIN_TOUCH_TARGET,
  darkTheme,
  lightTheme,
  radius,
  spacing,
  typography,
  type ThemeColors,
} from '@nabd/ui';

export function useTheme(): ThemeColors {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

export function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'primary' | 'danger';
}): React.JSX.Element {
  const colors = useTheme();
  const background = props.tone === 'danger' ? colors.danger : colors.primary;

  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled === true || props.busy === true}
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled === true, busy: props.busy === true }}
      style={({ pressed }) => [
        {
          backgroundColor: background,
          borderRadius: radius.md,
          minHeight: MIN_TOUCH_TARGET + 4,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: spacing.base,
        },
        props.disabled === true && { opacity: 0.4 },
        pressed && { opacity: 0.7 },
      ]}
    >
      {props.busy === true ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text style={{ ...typography.bodyStrong, color: colors.onPrimary }}>
          {props.label}
        </Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}): React.JSX.Element {
  const colors = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled === true}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          minHeight: MIN_TOUCH_TARGET,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: spacing.sm,
        },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={{ ...typography.body, color: colors.textPrimary }}>{props.label}</Text>
    </Pressable>
  );
}

export function Card(props: {
  children: React.ReactNode;
  padded?: boolean;
}): React.JSX.Element {
  const colors = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: props.padded === false ? 0 : spacing.base,
        marginBottom: spacing.md,
        overflow: 'hidden',
      }}
    >
      {props.children}
    </View>
  );
}

export function ScreenTitle(props: {
  title: string;
  subtitle?: string;
  rtl: boolean;
}): React.JSX.Element {
  const colors = useTheme();
  const align = props.rtl ? ('right' as const) : ('left' as const);
  const dir = props.rtl ? ('rtl' as const) : ('ltr' as const);

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text
        style={{
          ...typography.title,
          color: colors.textPrimary,
          textAlign: align,
          writingDirection: dir,
        }}
      >
        {props.title}
      </Text>
      {props.subtitle !== undefined && (
        <Text
          style={{
            ...typography.caption,
            color: colors.textSecondary,
            textAlign: align,
            writingDirection: dir,
            marginTop: spacing.xs,
          }}
        >
          {props.subtitle}
        </Text>
      )}
    </View>
  );
}

/** A labelled value row, used across transaction detail and card detail. */
export function DetailRow(props: {
  label: string;
  value: string;
  rtl: boolean;
  monospace?: boolean;
  last?: boolean;
}): React.JSX.Element {
  const colors = useTheme();
  return (
    <View
      style={{
        flexDirection: props.rtl ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.base,
        borderBottomWidth: props.last === true ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <Text style={{ ...typography.caption, color: colors.textMuted }}>{props.label}</Text>
      <Text
        style={{
          ...typography.bodyStrong,
          color: colors.textPrimary,
          ...(props.monospace === true ? { fontVariant: ['tabular-nums' as const] } : {}),
          flexShrink: 1,
          textAlign: props.rtl ? 'left' : 'right',
        }}
        numberOfLines={2}
      >
        {props.value}
      </Text>
    </View>
  );
}

export function StatusPill(props: {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}): React.JSX.Element {
  const colors = useTheme();
  const background =
    props.tone === 'success'
      ? colors.successSurface
      : props.tone === 'warning'
        ? colors.warningSurface
        : props.tone === 'danger'
          ? colors.dangerSurface
          : colors.background;
  const foreground =
    props.tone === 'success'
      ? colors.success
      : props.tone === 'warning'
        ? colors.warning
        : props.tone === 'danger'
          ? colors.danger
          : colors.textSecondary;

  return (
    <View
      style={{
        backgroundColor: background,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ ...typography.micro, color: foreground }}>{props.label}</Text>
    </View>
  );
}

export function ErrorText(props: { message: string; rtl: boolean }): React.JSX.Element {
  const colors = useTheme();
  return (
    <Text
      style={{
        ...typography.caption,
        color: colors.danger,
        textAlign: props.rtl ? 'right' : 'left',
        writingDirection: props.rtl ? 'rtl' : 'ltr',
        marginTop: spacing.sm,
      }}
      accessibilityRole="alert"
    >
      {props.message}
    </Text>
  );
}

export const sharedStyles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.base, paddingBottom: spacing.xxl },
  centered: { alignItems: 'center', justifyContent: 'center' },
});
