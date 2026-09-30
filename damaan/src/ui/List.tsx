import React from 'react';
import { I18nManager, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Symbol, type SymbolProps } from './Symbol';
import { Text } from './Text';

/**
 * An inset grouped list, the layout iOS Settings uses: a rounded card per
 * section, hairline separators inset to clear the leading icon, an optional
 * uppercase header and a footnote below.
 */
export function ListSection({
  header,
  footer,
  children,
  style,
}: {
  header?: string;
  footer?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={[{ marginTop: theme.space.xl }, style]}>
      {header ? (
        <Text
          variant="footnote"
          tone="secondary"
          style={{
            marginHorizontal: theme.space.lg * 2,
            marginBottom: theme.space.sm,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
          }}
        >
          {header}
        </Text>
      ) : null}

      <View
        style={{
          marginHorizontal: theme.space.lg,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.secondaryGroupedBackground,
          overflow: 'hidden',
        }}
      >
        {rows.map((row, index) => (
          <View key={index}>
            {index > 0 ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  marginStart: theme.space.lg,
                  backgroundColor: theme.colors.separator,
                }}
              />
            ) : null}
            {row}
          </View>
        ))}
      </View>

      {footer ? (
        <Text
          variant="footnote"
          tone="secondary"
          style={{ marginHorizontal: theme.space.lg * 2, marginTop: theme.space.sm }}
        >
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

export type RowProps = {
  title: string;
  subtitle?: string;
  /** Trailing detail text, e.g. a value or a date. */
  value?: string;
  icon?: SymbolProps['name'];
  /** Tinted rounded square behind the icon, as iOS Settings uses. */
  iconBackground?: string;
  iconColor?: string;
  onPress?: () => void;
  accessory?: 'chevron' | 'none';
  destructive?: boolean;
  /** Replaces the trailing area entirely — for switches, steppers, inputs. */
  trailing?: React.ReactNode;
  /** Replaces the whole row body — for custom cells inside a section. */
  children?: React.ReactNode;
};

export function Row({
  title,
  subtitle,
  value,
  icon,
  iconBackground,
  iconColor,
  onPress,
  accessory = onPress ? 'chevron' : 'none',
  destructive = false,
  trailing,
  children,
}: RowProps) {
  const theme = useTheme();

  const body = children ?? (
    <View style={styles.row}>
      {icon ? (
        <View
          style={[
            styles.iconBox,
            {
              marginEnd: theme.space.md,
              borderRadius: theme.radius.sm - 2,
              backgroundColor: iconBackground ?? theme.colors.tertiaryFill,
            },
          ]}
        >
          <Symbol name={icon} size={17} color={iconColor ?? theme.colors.label} weight="semibold" />
        </View>
      ) : null}

      <View style={styles.titleColumn}>
        <Text variant="body" tone={destructive ? 'destructive' : 'primary'} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone="secondary" numberOfLines={2} style={{ marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ?? (
        <View style={styles.trailing}>
          {value ? (
            <Text variant="body" tone="secondary" tabular numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          {accessory === 'chevron' ? (
            <Symbol
              name={I18nManager.isRTL ? 'chevron.left' : 'chevron.right'}
              size={14}
              color={theme.colors.tertiaryLabel}
              weight="bold"
            />
          ) : null}
        </View>
      )}
    </View>
  );

  if (!onPress) {
    return <View style={{ minHeight: theme.minTouchTarget }}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { minHeight: theme.minTouchTarget },
        pressed ? { backgroundColor: theme.colors.quaternaryFill } : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 44,
  },
  iconBox: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center' },
  titleColumn: { flex: 1 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 6, marginStart: 8, maxWidth: '50%' },
});
