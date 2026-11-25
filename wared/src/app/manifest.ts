import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/ar',
    name: 'وارد',
    short_name: 'وارد',
    description: 'وارد منصة إعلامية سعودية مستقلة: بودكاست وقصص وحوارات وتجارب إنسانية ومقالات.',
    start_url: '/ar?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    dir: 'rtl',
    lang: 'ar',
    background_color: '#171717',
    theme_color: '#171717',
    categories: ['entertainment', 'news', 'podcasts'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'الحلقات', url: '/ar/episodes' },
      { name: 'القصص والمقالات', url: '/ar/stories' },
    ],
  };
}
