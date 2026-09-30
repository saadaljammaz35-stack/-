import { I18nManager, StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '../theme';

type Variant = keyof ReturnType<typeof useTheme>['type'];
type Tone = 'primary' | 'secondary' | 'tertiary' | 'brand' | 'destructive' | 'success' | 'warning' | 'inverted';

export type AppTextProps = TextProps & {
  variant?: Variant;
  tone?: Tone;
  /** Centre the text within its own box. Defaults to natural (start-aligned). */
  align?: 'natural' | 'center' | 'end';
  /** Render digits so mixed Arabic/number lines stay readable. */
  tabular?: boolean;
};

export function Text({
  variant = 'body',
  tone = 'primary',
  align = 'natural',
  tabular = false,
  style,
  ...rest
}: AppTextProps) {
  const theme = useTheme();

  const toneColor: Record<Tone, string> = {
    primary: theme.colors.label,
    secondary: theme.colors.secondaryLabel,
    tertiary: theme.colors.tertiaryLabel,
    brand: theme.colors.brand,
    destructive: theme.colors.red,
    success: theme.colors.green,
    warning: theme.colors.orange,
    inverted: theme.appearance === 'dark' ? '#000000' : '#FFFFFF',
  };

  const alignment: TextStyle['textAlign'] =
    align === 'center' ? 'center' : align === 'end' ? (I18nManager.isRTL ? 'left' : 'right') : undefined;

  return (
    <RNText
      {...rest}
      style={StyleSheet.flatten([
        theme.type[variant] as TextStyle,
        { color: toneColor[tone] },
        alignment ? { textAlign: alignment } : null,
        tabular ? { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] } : null,
        style,
      ])}
    />
  );
}
