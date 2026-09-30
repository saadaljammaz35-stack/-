import { View } from 'react-native';

import { useTheme } from '../theme';

/**
 * The iOS capsule progress track. `value` is clamped to 0…1 so a deadline
 * that has already passed does not overflow the bar.
 */
export function ProgressBar({ value, color, height = 6 }: { value: number; color: string; height?: number }) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: theme.colors.quaternaryFill,
        overflow: 'hidden',
      }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View style={{ width: `${clamped * 100}%`, height: '100%', borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}
