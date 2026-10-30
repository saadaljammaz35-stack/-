import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '@/store/settings';

import { buildPalette, fonts, radius, space, type Palette } from './tokens';

export type Theme = {
  colors: Palette;
  fonts: typeof fonts;
  radius: typeof radius;
  space: typeof space;
  /** Scales a UI font size by the user's preference. */
  fs: (size: number) => number;
  /** Scales reading text (adhkar, hadith, tafsir). */
  rs: (size: number) => number;
  mode: 'light' | 'dark' | 'warm' | 'red';
  isRTL: boolean;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const themeMode = useSettings((s) => s.themeMode);
  const accent = useSettings((s) => s.accent);
  const uiScale = useSettings((s) => s.uiScale);
  const readingScale = useSettings((s) => s.readingScale);
  const readingFont = useSettings((s) => s.readingFont);
  const language = useSettings((s) => s.language);

  const value = useMemo<Theme>(() => {
    const mode = themeMode === 'system' ? (system === 'dark' ? 'dark' : 'light') : themeMode;
    return {
      colors: buildPalette(mode, accent),
      fonts: {
        ...fonts,
        reading: readingFont === 'plex' ? fonts.regular : fonts.reading,
        readingBold: readingFont === 'plex' ? fonts.semibold : fonts.readingBold,
      },
      radius,
      space,
      fs: (n) => Math.round(n * uiScale),
      rs: (n) => Math.round(n * readingScale),
      mode,
      isRTL: language === 'ar',
    };
  }, [themeMode, system, accent, uiScale, readingScale, readingFont, language]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside ThemeProvider');
  return t;
}
