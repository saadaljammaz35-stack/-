/**
 * MEDAD — business configuration.
 *
 * This is the single place for the studio's public contact details and
 * social profiles. Every value is optional: anything left as `null` is simply
 * not rendered on the site, so nothing invented ever appears in production.
 *
 * Fill these in with the studio's real details before launch.
 */

export type SocialPlatform = 'instagram' | 'x' | 'linkedin' | 'behance' | 'dribbble' | 'tiktok';

export interface SiteConfig {
  /** Display name, used in metadata and structured data. */
  name: { ar: string; en: string };
  /** Public contact email, e.g. 'hello@your-domain.com'. */
  email: string | null;
  /** Public phone in international format; spaces are for display only. */
  phone: string | null;
  /** WhatsApp number in international format without '+' or spaces, e.g. '9665XXXXXXXX'. */
  whatsapp: string | null;
  /** City / region line, shown in the footer when set. */
  location: { ar: string; en: string } | null;
  /** Social profiles. Entries with an empty `url` are hidden. */
  social: { platform: SocialPlatform; url: string | null }[];
}

export const siteConfig: SiteConfig = {
  name: { ar: 'مِداد', en: 'MEDAD' },
  email: 'saadaljammaz35@gmail.com',
  phone: '+966 53 463 2580',
  whatsapp: null,
  location: null,
  social: [
    { platform: 'instagram', url: null },
    { platform: 'x', url: null },
    { platform: 'linkedin', url: null },
    { platform: 'behance', url: null },
  ],
};

/** Absolute base URL of the deployment (canonical URLs, Open Graph, sitemap). */
export function getSiteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL('http://localhost:3000');
}

export function activeSocial(config: SiteConfig = siteConfig) {
  return config.social.filter((s): s is { platform: SocialPlatform; url: string } =>
    Boolean(s.url),
  );
}

/** `tel:` link for a display-formatted phone number. */
export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
