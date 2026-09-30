import { View } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { useTheme } from '../theme';

export type SymbolProps = {
  name: SymbolViewProps['name'];
  size?: number;
  color?: string;
  weight?: SymbolViewProps['weight'];
  type?: SymbolViewProps['type'];
};

/**
 * An SF Symbol. On platforms without SF Symbols the `fallback` keeps layout
 * stable by reserving the same box instead of collapsing the row.
 */
export function Symbol({ name, size = 22, color, weight = 'regular', type = 'monochrome' }: SymbolProps) {
  const theme = useTheme();
  const tint = color ?? theme.colors.label;

  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={tint}
      weight={weight}
      type={type}
      fallback={<View style={{ width: size, height: size, borderRadius: size / 4, backgroundColor: tint, opacity: 0.25 }} />}
    />
  );
}
