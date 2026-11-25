import type { CategoryKind } from './catalog-types';

/** Product photography in the new white SAMAT packaging (studio design). */
const BY_SLUG: Record<string, string> = {
  'samat-burger': '/media/studio/burger.webp',
  'samat-shawarma': '/media/studio/shawarma.webp',
  'samat-fries': '/media/studio/fries.webp',
  'arabi-combo': '/media/studio/arabi-combo.webp',
};
const BY_KIND: Record<CategoryKind, string> = {
  burger: '/media/studio/burger.webp',
  shawarma: '/media/studio/shawarma.webp',
  fries: '/media/studio/fries.webp',
};

export const studioImage = (slug: string, kind: CategoryKind, current: string | null) => BY_SLUG[slug] ?? current ?? BY_KIND[kind];

export const STUDIO = {
  hero: '/media/studio/hero.webp',
  heroBg: '#eeeef1',
  burgerDark: '/media/studio/burger-dark.webp',
  packaging: '/media/studio/packaging.webp',
  detail: '/media/studio/detail.webp',
  bag: '/media/studio/bag.webp',
};
