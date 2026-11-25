import type { MetadataRoute } from 'next';
import { absoluteUrl, publicEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  if (publicEnv.demoContent) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/ar/search', '/en/search', '/ar/newsletter', '/en/newsletter'] },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
