import type { BrandSlug, ProjectSlug } from '@/content/types';

/** The "world" each project card lives in, derived from the project's own palette. */
export const WORLDS: Record<ProjectSlug, { bg: string; glow: string; accent: string }> = {
  mubayn: {
    bg: 'radial-gradient(90% 90% at 85% 10%, #3a2c14 0%, #17202b 45%, #0c1118 100%)',
    glow: 'rgb(242 169 59 / 0.32)',
    accent: '#F2A93B',
  },
  labina: {
    bg: 'radial-gradient(90% 90% at 85% 10%, #4f2c63 0%, #2a1636 48%, #150b1c 100%)',
    glow: 'rgb(222 121 104 / 0.38)',
    accent: '#EFC95E',
  },
  clinibot: {
    bg: 'radial-gradient(90% 90% at 85% 10%, #0b4a3d 0%, #082a33 48%, #04121c 100%)',
    glow: 'rgb(16 185 129 / 0.32)',
    accent: '#34D399',
  },
};

/** Tile colour behind each logo, matched to the artwork's own background. */
export const BRAND_BG: Record<BrandSlug, string> = {
  mubayn: '#111A23',
  labina: '#F5ECDB',
  dunyaa: '#630708',
  x: '#0E0E0E',
  sahm: '#160100',
};

/** Bare host name of a project URL, for display. */
export function host(url: string) {
  return new URL(url).host.replace(/^www\./, '');
}
