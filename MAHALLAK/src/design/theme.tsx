import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, useColorScheme } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { dark, light, type Palette } from './tokens';

export interface Theme {
  c: Palette;
  isDark: boolean;
  /** Solid surfaces instead of translucency (OS setting or in-app preference). */
  reduceTransparency: boolean;
  /** Cross-fades instead of motion (OS setting). */
  reduceMotion: boolean;
}

const ThemeContext = createContext<Theme>({ c: light, isDark: false, reduceTransparency: false, reduceMotion: false });

export function ThemeProvider({
  mode,
  forceSolid,
  children,
}: {
  mode: 'system' | 'light' | 'dark';
  forceSolid: boolean;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const reduceMotion = useReducedMotion();
  const [osReduceTransparency, setOsReduceTransparency] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AccessibilityInfo.isReduceTransparencyEnabled().then(setOsReduceTransparency).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setOsReduceTransparency);
    return () => sub.remove();
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');
  const value = useMemo<Theme>(
    () => ({ c: isDark ? dark : light, isDark, reduceTransparency: forceSolid || osReduceTransparency, reduceMotion }),
    [isDark, forceSolid, osReduceTransparency, reduceMotion],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
