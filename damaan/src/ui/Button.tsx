import React from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../theme';
import { Symbol, type SymbolProps } from './Symbol';
import { Text } from './Text';

type Kind = 'filled' | 'tinted' | 'plain';

export function Button({
  title,
  onPress,
  kind = 'filled',
  icon,
  destructive = false,
  disabled = false,
  full = false,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: Kind;
  icon?: SymbolProps['name'];
  destructive?: boolean;
  disabled?: boolean;
  full?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const accent = destructive ? theme.colors.red : theme.colors.brand;

  const surface: Record<Kind, ViewStyle> = {
    filled: { backgroundColor: accent },
    tinted: { backgroundColor: theme.appearance === 'dark' ? 'rgba(94,92,230,0.22)' : 'rgba(88,86,214,0.12)' },
    plain: { backgroundColor: 'transparent' },
  };

  const labelColor = kind === 'filled' ? '#FFFFFF' : accent;

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space.sm,
          minHeight: 50,
          paddingHorizontal: theme.space.xl,
          borderRadius: theme.radius.lg,
          alignSelf: full ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        surface[kind],
        style,
      ]}
    >
      {icon ? <Symbol name={icon} size={18} color={labelColor} weight="semibold" /> : null}
      <Text variant="bodyEmphasized" style={{ color: labelColor }}>
        {title}
      </Text>
    </Pressable>
  );
}

/** Groups stacked full-width buttons with consistent spacing. */
export function ButtonStack({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={{ gap: theme.space.md, marginHorizontal: theme.space.lg }}>{children}</View>;
}
