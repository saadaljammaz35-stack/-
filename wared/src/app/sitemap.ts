import type { MetadataRoute } from 'next';
import { getSitemapEntries } from '@/lib/data/public';
import { absoluteUrl } from '@/lib/env';
import { locales } from '@/lib/i18n/config';

export const revalidate = 3600;

const STATIC_PATHS = ['', '/podcast', '/episodes', '/programs', '/stories', '/clips', '/guests', '/about', '/join', '/sponsorship', '/contact', '/privacy', '/terms'];

function alternates(path: string) {
  return { languages: { 'ar-SA': absoluteUrl(`/ar${path}`), en: absoluteUrl(`/en${path}`) } };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getSitemapEntries();
  const now = new Date();
  return [
    ...STATIC_PATHS.flatMap((path) =>
      locales.map((locale) => ({
        url: absoluteUrl(`/${locale}${path}`),
        lastModified: now,
        changeFrequency: path === '' || path === '/episodes' ? ('daily' as const) : ('monthly' as const),
        priority: path === '' ? 1 : 0.6,
        alternates: alternates(path),
      })),
    ),
    ...entries.flatMap((entry) =>
      locales.map((locale) => ({
        url: absoluteUrl(`/${locale}${entry.path}`),
        lastModified: entry.updatedAt ? new Date(entry.updatedAt) : now,
        changeFrequency: 'weekly' as const,
        priority: entry.path.startsWith('/episodes') ? 0.8 : 0.7,
        alternates: alternates(entry.path),
      })),
    ),
  ];
}
