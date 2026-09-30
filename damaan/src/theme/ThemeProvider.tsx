import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { minTouchTarget, palette, radius, space, type, type Appearance, type Palette } from './tokens';

type Theme = {
  appearance: Appearance;
  colors: Palette;
  type: typeof type;
  space: typeof space;
  radius: typeof radius;
  minTouchTarget: number;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const appearance: Appearance = scheme === 'dark' ? 'dark' : 'light';

  const value = useMemo<Theme>(
    () => ({ appearance, colors: palette(appearance), type, space, radius, minTouchTarget }),
    [appearance],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>');
  return theme;
}
