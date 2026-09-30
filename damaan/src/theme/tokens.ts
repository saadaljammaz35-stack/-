/**
 * Apple Human Interface Guidelines design tokens.
 *
 * Colours mirror the iOS system palette (semantic, not literal) so the app
 * looks native in both light and dark appearance. Never hardcode a hex value
 * in a component — pull it from the palette the theme hands you.
 */

export type Appearance = 'light' | 'dark';

/** iOS system colours — the vivid, interactive set. */
const systemColors = {
  blue: { light: '#007AFF', dark: '#0A84FF' },
  green: { light: '#34C759', dark: '#30D158' },
  indigo: { light: '#5856D6', dark: '#5E5CE6' },
  orange: { light: '#FF9500', dark: '#FF9F0A' },
  pink: { light: '#FF2D55', dark: '#FF375F' },
  purple: { light: '#AF52DE', dark: '#BF5AF2' },
  red: { light: '#FF3B30', dark: '#FF453A' },
  teal: { light: '#30B0C7', dark: '#40C8E0' },
  yellow: { light: '#FFCC00', dark: '#FFD60A' },
} as const;

/** iOS greys — gray through gray6, coarse to fine. */
const grays = {
  gray: { light: '#8E8E93', dark: '#8E8E93' },
  gray2: { light: '#AEAEB2', dark: '#636366' },
  gray3: { light: '#C7C7CC', dark: '#48484A' },
  gray4: { light: '#D1D1D6', dark: '#3A3A3C' },
  gray5: { light: '#E5E5EA', dark: '#2C2C2E' },
  gray6: { light: '#F2F2F7', dark: '#1C1C1E' },
} as const;

function pick<T extends Record<string, { light: string; dark: string }>>(
  source: T,
  appearance: Appearance,
): { [K in keyof T]: string } {
  const out = {} as { [K in keyof T]: string };
  for (const key of Object.keys(source) as (keyof T)[]) {
    // Keys come from `Object.keys` of the same object, so the lookup is total.
    out[key] = source[key]![appearance];
  }
  return out;
}

export function palette(appearance: Appearance) {
  const dark = appearance === 'dark';
  return {
    ...pick(systemColors, appearance),
    ...pick(grays, appearance),

    // Backgrounds — plain hierarchy.
    background: dark ? '#000000' : '#FFFFFF',
    secondaryBackground: dark ? '#1C1C1E' : '#F2F2F7',
    tertiaryBackground: dark ? '#2C2C2E' : '#FFFFFF',

    // Backgrounds — grouped hierarchy, for inset list screens.
    groupedBackground: dark ? '#000000' : '#F2F2F7',
    secondaryGroupedBackground: dark ? '#1C1C1E' : '#FFFFFF',
    tertiaryGroupedBackground: dark ? '#2C2C2E' : '#F2F2F7',

    // Labels.
    label: dark ? '#FFFFFF' : '#000000',
    secondaryLabel: dark ? 'rgba(235,235,245,0.60)' : 'rgba(60,60,67,0.60)',
    tertiaryLabel: dark ? 'rgba(235,235,245,0.30)' : 'rgba(60,60,67,0.30)',
    quaternaryLabel: dark ? 'rgba(235,235,245,0.16)' : 'rgba(60,60,67,0.18)',
    placeholderText: dark ? 'rgba(235,235,245,0.30)' : 'rgba(60,60,67,0.30)',

    // Separators.
    separator: dark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.29)',
    opaqueSeparator: dark ? '#38383A' : '#C6C6C8',

    // Fills — for non-text elements sitting on a background.
    fill: dark ? 'rgba(120,120,128,0.36)' : 'rgba(120,120,128,0.20)',
    secondaryFill: dark ? 'rgba(120,120,128,0.32)' : 'rgba(120,120,128,0.16)',
    tertiaryFill: dark ? 'rgba(118,118,128,0.24)' : 'rgba(118,118,128,0.12)',
    quaternaryFill: dark ? 'rgba(118,118,128,0.18)' : 'rgba(116,116,128,0.08)',

    /** The product's identity colour. Indigo reads as "kept safe". */
    brand: dark ? '#5E5CE6' : '#5856D6',
  };
}

export type Palette = ReturnType<typeof palette>;

/**
 * iOS text styles at the default Dynamic Type size. `fontFamily` stays
 * undefined so each platform resolves its own system face — on iOS that is
 * SF Pro for Latin and SF Arabic for Arabic, which is exactly what we want.
 */
export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  bodyEmphasized: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400' },
} as const;

/** 8pt rhythm, with the 4pt half-step iOS uses for tight groupings. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

/** Continuous-corner radii matching iOS controls and cards. */
export const radius = { sm: 8, md: 10, lg: 14, xl: 20, pill: 999 } as const;

/** The 44pt minimum touch target from the HIG. */
export const minTouchTarget = 44;
