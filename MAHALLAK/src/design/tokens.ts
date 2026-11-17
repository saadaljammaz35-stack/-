/**
 * MAHALLAK design tokens. Brand palette from the identity:
 * Dark Emerald #12392F, Deep Forest #0B2923, Warm Beige #F1E8D8,
 * Ivory #FFFDF7, Muted Gold #C5A66A.
 */
export const brand = {
  emerald: '#12392F',
  forest: '#0B2923',
  beige: '#F1E8D8',
  ivory: '#FFFDF7',
  gold: '#C5A66A',
  goldLight: '#E4D0A0',
  goldDeep: '#8C6D35',
  emeraldBright: '#1F5C4B',
} as const;

export interface Palette {
  scheme: 'light' | 'dark';
  /** Ambient background: top -> bottom gradient and two soft light sources. */
  bg: [string, string, string];
  glowA: string;
  glowB: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  /** Text and icons placed on the primary (emerald) fill. */
  onPrimary: string;
  primary: string;
  primaryPressed: string;
  accent: string;
  /** Gold that keeps 4.5:1 contrast for small text on this scheme. */
  accentText: string;
  /** Glass material, thin -> thick. */
  glass: { thin: string; regular: string; thick: string };
  /** Solid fallback when transparency is reduced. */
  solid: string;
  border: string;
  highlight: string;
  hairline: string;
  shadow: string;
  danger: string;
  success: string;
  warning: string;
  scrim: string;
  blurTint: 'light' | 'dark';
}

export const light: Palette = {
  scheme: 'light',
  bg: ['#FFFDF7', '#F6EFE2', '#EDE2CC'],
  glowA: 'rgba(31, 92, 75, 0.20)',
  glowB: 'rgba(197, 166, 106, 0.34)',
  text: '#0B2923',
  textSecondary: 'rgba(11, 41, 35, 0.68)',
  textTertiary: 'rgba(11, 41, 35, 0.6)',
  onPrimary: '#FFFDF7',
  primary: '#12392F',
  primaryPressed: '#0B2923',
  accent: '#C5A66A',
  accentText: '#7A5D27',
  glass: {
    thin: 'rgba(255, 253, 247, 0.42)',
    regular: 'rgba(255, 253, 247, 0.62)',
    thick: 'rgba(255, 253, 247, 0.80)',
  },
  solid: '#FBF7EE',
  border: 'rgba(255, 255, 255, 0.85)',
  highlight: 'rgba(255, 255, 255, 0.95)',
  hairline: 'rgba(18, 57, 47, 0.10)',
  shadow: 'rgba(11, 41, 35, 0.16)',
  danger: '#B3261E',
  success: '#2E7D57',
  warning: '#9A6B00',
  scrim: 'rgba(11, 41, 35, 0.35)',
  blurTint: 'light',
};

export const dark: Palette = {
  scheme: 'dark',
  bg: ['#123A30', '#0B2923', '#061713'],
  glowA: 'rgba(52, 140, 112, 0.30)',
  glowB: 'rgba(197, 166, 106, 0.20)',
  text: '#FFFDF7',
  textSecondary: 'rgba(241, 232, 216, 0.74)',
  textTertiary: 'rgba(241, 232, 216, 0.62)',
  onPrimary: '#0B2923',
  primary: '#D9BE86',
  primaryPressed: '#C5A66A',
  accent: '#C5A66A',
  accentText: '#E4D0A0',
  glass: {
    thin: 'rgba(30, 80, 66, 0.28)',
    regular: 'rgba(22, 64, 53, 0.46)',
    thick: 'rgba(16, 50, 41, 0.70)',
  },
  solid: '#123A30',
  border: 'rgba(255, 255, 255, 0.14)',
  highlight: 'rgba(255, 255, 255, 0.22)',
  hairline: 'rgba(241, 232, 216, 0.10)',
  shadow: 'rgba(0, 0, 0, 0.45)',
  danger: '#F2B8B5',
  success: '#8FD4AE',
  warning: '#F0C46A',
  scrim: 'rgba(0, 0, 0, 0.5)',
  blurTint: 'dark',
};

export const radius = { xs: 10, sm: 14, md: 20, lg: 26, xl: 34, pill: 999 } as const;
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 28, xxl: 40 } as const;

export const fonts = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
} as const;

/**
 * Type scale. Arabic needs generous line height for marks above and below the
 * baseline. Letter-spacing is never applied to Arabic (it breaks joining);
 * only the Latin wordmark uses tracking.
 */
export const type = {
  display: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 46 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 36 },
  headline: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 28 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 26 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 26 },
  callout: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 23 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 },
  micro: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
} as const;
export type TypeVariant = keyof typeof type;

/** Springs (Reanimated): critically damped by default, bounce only after momentum. */
export const springs = {
  press: { dampingRatio: 1, duration: 160 },
  standard: { dampingRatio: 1, duration: 380 },
  momentum: { dampingRatio: 0.8, duration: 420 },
} as const;
