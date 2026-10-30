// Visual identity of «مع الله»: sage green and warm cream taken from the logo.
import type { AccentId } from '@/store/settings';

export type Palette = {
  scheme: 'light' | 'dark';
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  /** Background of filled surfaces that carry white text (cards, buttons, active chips). */
  fill: string;
  onPrimary: string;
  highlight: string;
  gold: string;
  danger: string;
  success: string;
  warning: string;
  mushafPaper: string;
  mushafInk: string;
  mushafFrame: string;
  overlay: string;
  /** Floating bars. Opaque, so iOS draws their shadow from a path instead of re-rendering it every frame of a scroll. */
  tabBar: string;
  // Soft tints for icon circles (matches the calm, pastel tiles of the reference design)
  tints: [string, string, string, string, string, string];
};

// Deep, low-luminance fills for dark mode so white text keeps its contrast.
const DARK_FILL: Record<AccentId, string> = { sage: '#34502C', teal: '#1E4A45', olive: '#4A4726', navy: '#26395A', plum: '#4A3047' };

const ACCENTS: Record<AccentId, { light: [string, string, string]; dark: [string, string, string] }> = {
  // [primary, deep, soft]
  sage: { light: ['#5A6E51', '#2F4529', '#E3EADB'], dark: ['#A8C29B', '#D5E4CC', '#25321F'] },
  teal: { light: ['#2F6F6A', '#1B4743', '#D8EBE8'], dark: ['#8CC8C0', '#C9E8E3', '#17302D'] },
  olive: { light: ['#6E6A3C', '#454222', '#EBE8D2'], dark: ['#C8C28A', '#E6E1B9', '#2C2A17'] },
  navy: { light: ['#34507A', '#1F3352', '#DCE5F2'], dark: ['#9DB6DC', '#CFDDF1', '#1A2638'] },
  plum: { light: ['#6E4C6A', '#472E44', '#EEDFEB'], dark: ['#CDA5C7', '#E8D2E4', '#2E1F2C'] },
};

export function buildPalette(mode: 'light' | 'dark' | 'warm' | 'red', accent: AccentId): Palette {
  if (mode === 'red') {
    // «إضاءة حمراء لقيام الليل»: dim red on black, which leaves eyes adjusted to the dark.
    return {
      scheme: 'dark',
      background: '#000000',
      backgroundAlt: '#060000',
      surface: '#0C0101',
      surfaceAlt: '#160303',
      border: '#2A0707',
      text: '#D23A2A',
      textMuted: '#9A2A1F',
      textFaint: '#6A1D15',
      primary: '#C8321F',
      primaryDeep: '#E0412B',
      primarySoft: '#240505',
      fill: '#4A0C07',
      onPrimary: '#000000',
      highlight: '#E0412B',
      gold: '#B8401F',
      danger: '#FF5A3C',
      success: '#B8401F',
      warning: '#C8501F',
      mushafPaper: '#000000',
      mushafInk: '#C8321F',
      mushafFrame: '#8A2418',
      overlay: 'rgba(0,0,0,0.7)',
      tabBar: '#0C0101',
      tints: ['#1A0303', '#1A0303', '#1A0303', '#1A0303', '#1A0303', '#1A0303'],
    };
  }
  if (mode === 'dark') {
    const [primary, deep, soft] = ACCENTS[accent].dark;
    return {
      scheme: 'dark',
      background: '#0F130E',
      backgroundAlt: '#131A12',
      surface: '#182017',
      surfaceAlt: '#1F291D',
      border: '#2A3527',
      text: '#ECEFE6',
      textMuted: '#A8B2A3',
      textFaint: '#77826F',
      primary,
      primaryDeep: deep,
      primarySoft: soft,
      fill: DARK_FILL[accent],
      onPrimary: '#0F130E',
      highlight: '#C9E28F',
      gold: '#D2B472',
      danger: '#E38C78',
      success: '#8FCB8B',
      warning: '#E6C26B',
      mushafPaper: '#141A13',
      mushafInk: '#E6E9DF',
      mushafFrame: primary,
      overlay: 'rgba(0,0,0,0.55)',
      tabBar: '#182017',
      tints: ['#26301F', '#2A2533', '#1E2C33', '#33291F', '#1F3328', '#332127'],
    };
  }
  const [primary, deep, soft] = ACCENTS[accent].light;
  if (mode === 'warm') {
    return {
      scheme: 'light',
      background: '#F5EEDD',
      backgroundAlt: '#EFE5CE',
      surface: '#FBF6E9',
      surfaceAlt: '#F1E8D3',
      border: '#E2D5B8',
      text: '#3A2F1C',
      textMuted: '#7A6A4D',
      textFaint: '#A3937A',
      primary,
      primaryDeep: deep,
      primarySoft: '#EAE0C6',
      fill: deep,
      onPrimary: '#FFFFFF',
      highlight: '#B9D27A',
      gold: '#A8873F',
      danger: '#A64B35',
      success: '#5B7F45',
      warning: '#B8892C',
      mushafPaper: '#F7EFDC',
      mushafInk: '#2E2414',
      mushafFrame: '#8C7A4E',
      overlay: 'rgba(40,30,10,0.45)',
      tabBar: '#FBF6E9',
      tints: ['#EDE6CF', '#EBDFE8', '#DCE8E6', '#F0E2CC', '#E1EBD5', '#F1DADA'],
    };
  }
  return {
    scheme: 'light',
    background: '#F7F6F0',
    backgroundAlt: '#EEF1E8',
    surface: '#FFFFFF',
    surfaceAlt: '#F3F2EA',
    border: '#E6E4D9',
    text: '#1F2A1C',
    textMuted: '#626C5F',
    textFaint: '#9AA196',
    primary,
    primaryDeep: deep,
    primarySoft: soft,
    fill: deep,
    onPrimary: '#FFFFFF',
    highlight: '#C5E08A',
    gold: '#A88B4A',
    danger: '#B4533F',
    success: '#4E8A4A',
    warning: '#B98A2A',
    mushafPaper: '#FFFEFA',
    mushafInk: '#202020',
    mushafFrame: primary,
    overlay: 'rgba(20,30,18,0.45)',
    tabBar: '#FFFFFF',
    tints: ['#E9E7DC', '#ECE4F1', '#DEECEE', '#F6E7D6', '#E3F0D8', '#F7DFE1'],
  };
}

export const ACCENT_OPTIONS: { id: AccentId; name: string; color: string }[] = [
  { id: 'sage', name: 'أخضر مريمي', color: ACCENTS.sage.light[0] },
  { id: 'teal', name: 'فيروزي', color: ACCENTS.teal.light[0] },
  { id: 'olive', name: 'زيتوني', color: ACCENTS.olive.light[0] },
  { id: 'navy', name: 'كحلي', color: ACCENTS.navy.light[0] },
  { id: 'plum', name: 'برقوقي', color: ACCENTS.plum.light[0] },
];

export const fonts = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
  reading: 'Amiri_400Regular',
  readingBold: 'Amiri_700Bold',
  quran: 'UthmanicHafs',
};

export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
