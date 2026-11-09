import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl().toString().replace(/\/$/, '');
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
