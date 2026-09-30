import { View } from 'react-native';

import { useTheme } from '../theme';
import { Symbol, type SymbolProps } from './Symbol';
import { Text } from './Text';

/** A tinted capsule label — status, category, countdown. */
export function Badge({
  label,
  color,
  icon,
  filled = false,
}: {
  label: string;
  color: string;
  icon?: SymbolProps['name'];
  filled?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: theme.space.sm,
        paddingVertical: 3,
        borderRadius: theme.radius.pill,
        backgroundColor: filled ? color : withAlpha(color, theme.appearance === 'dark' ? 0.24 : 0.14),
      }}
    >
      {icon ? <Symbol name={icon} size={11} color={filled ? '#FFFFFF' : color} weight="bold" /> : null}
      <Text variant="caption1" style={{ color: filled ? '#FFFFFF' : color, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

/** Blends a hex colour with transparency without pulling in a colour library. */
export function withAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
