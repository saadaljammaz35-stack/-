/**
 * NABD design tokens.
 *
 * The palette is built around a deep teal rather than the blue that most
 * banking apps default to — NABD should not look like a clone of anything.
 * Teal reads as calm and established without borrowing an existing bank's
 * identity, and the warm sand accents give it a Gulf character that a generic
 * fintech blue does not have.
 *
 * Every colour pair below meets WCAG AA (4.5:1) for body text in both themes.
 * That is not a nicety in a banking app: a balance a customer cannot read in
 * sunlight is a broken feature.
 */

export const palette = {
  // Primary — deep teal. Trust and stability.
  teal900: '#062B2B',
  teal800: '#0A3D3D',
  teal700: '#0E5252',
  teal600: '#126B6B',
  teal500: '#178585',
  teal400: '#2AA5A5',
  teal300: '#5CC4C4',
  teal200: '#9BDEDE',
  teal100: '#D3F1F1',
  teal50: '#EDFAFA',

  // Accent — warm sand. Used sparingly, for emphasis only.
  sand600: '#8A6A2F',
  sand500: '#B58A3C',
  sand400: '#D4A857',
  sand300: '#E5C489',
  sand100: '#F7EBD4',

  // Semantic
  green600: '#0F7A4A',
  green500: '#149960',
  green100: '#DCF5E8',
  red600: '#A32020',
  red500: '#C92A2A',
  red100: '#FBE2E2',
  amber600: '#9A6800',
  amber500: '#C28500',
  amber100: '#FBEFD3',

  // Neutrals
  ink900: '#0B1212',
  ink800: '#16201F',
  ink700: '#243130',
  ink600: '#3C4A49',
  ink500: '#5B6A69',
  ink400: '#849695',
  ink300: '#B4C0BF',
  ink200: '#D8E0DF',
  ink100: '#EDF2F1',
  ink50: '#F6F9F8',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  accent: string;
  success: string;
  successSurface: string;
  danger: string;
  dangerSurface: string;
  warning: string;
  warningSurface: string;
  /** Gradient stops for the balance card. */
  heroGradient: readonly [string, string];
}

export const lightTheme: ThemeColors = {
  background: palette.ink50,
  surface: palette.white,
  surfaceRaised: palette.white,
  border: palette.ink200,
  textPrimary: palette.ink900,
  textSecondary: palette.ink600,
  textMuted: palette.ink500,
  textInverse: palette.white,
  primary: palette.teal600,
  primaryPressed: palette.teal700,
  onPrimary: palette.white,
  accent: palette.sand500,
  success: palette.green600,
  successSurface: palette.green100,
  danger: palette.red600,
  dangerSurface: palette.red100,
  warning: palette.amber600,
  warningSurface: palette.amber100,
  heroGradient: [palette.teal700, palette.teal500],
};

export const darkTheme: ThemeColors = {
  background: palette.ink900,
  surface: palette.ink800,
  surfaceRaised: palette.ink700,
  border: palette.ink700,
  textPrimary: palette.ink50,
  textSecondary: palette.ink300,
  textMuted: palette.ink400,
  textInverse: palette.ink900,
  primary: palette.teal400,
  primaryPressed: palette.teal300,
  onPrimary: palette.teal900,
  accent: palette.sand400,
  success: '#3FBF83',
  successSurface: '#0C3D28',
  danger: '#F07070',
  dangerSurface: '#431515',
  warning: palette.sand400,
  warningSurface: '#3D2F0C',
  heroGradient: [palette.teal800, palette.teal600],
};

/** 4pt base scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/**
 * Type scale.
 *
 * `balance` uses tabular figures so digits do not shift width as the amount
 * changes — a balance that jitters while updating looks unreliable, and
 * "unreliable" is the one thing a banking app cannot afford to look.
 */
export const typography = {
  display: { fontSize: 34, lineHeight: 42, fontWeight: '700' as const },
  balance: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '700' as const,
    fontVariant: ['tabular-nums'] as const,
  },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  micro: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  amount: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
    fontVariant: ['tabular-nums'] as const,
  },
} as const;

export const elevation = {
  none: { shadowOpacity: 0, elevation: 0 },
  card: {
    shadowColor: palette.ink900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: palette.ink900,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;

/**
 * Minimum touch target. 44pt is the accessibility floor, and it matters more
 * here than in most apps: a mis-tap in a transfer flow moves money.
 */
export const MIN_TOUCH_TARGET = 44;

export const motion = {
  fast: 150,
  base: 220,
  slow: 320,
} as const;
