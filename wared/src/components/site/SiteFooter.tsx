import Link from 'next/link';
import type { Dictionary } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { localePath, type Locale } from '@/lib/i18n/config';
import type { SiteSettings } from '@/lib/types';
import { Logo } from './Logo';

const SOCIAL_LABELS: Record<keyof SiteSettings['social'], string> = {
  x: 'X',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
};

export function SiteFooter({ locale, dict, settings }: { locale: Locale; dict: Dictionary; settings: SiteSettings }) {
  const p = (path: string) => localePath(locale, path);
  const social = (Object.keys(SOCIAL_LABELS) as (keyof SiteSettings['social'])[])
    .map((key) => ({ key, url: settings.social[key] }))
    .filter((s): s is { key: keyof SiteSettings['social']; url: string } => Boolean(s.url && /^https:\/\//.test(s.url)));

  const columns = [
    {
      title: dict.footer.explore,
      links: [
        { href: p('/podcast'), label: dict.nav.podcast },
        { href: p('/episodes'), label: dict.nav.episodes },
        { href: p('/programs'), label: dict.nav.programs },
        { href: p('/stories'), label: dict.nav.stories },
        { href: p('/clips'), label: dict.nav.clips },
        { href: p('/guests'), label: dict.nav.guests },
      ],
    },
    {
      title: dict.footer.company,
      links: [
        { href: p('/about'), label: dict.nav.about },
        { href: p('/join'), label: dict.nav.join },
        { href: p('/sponsorship'), label: dict.nav.sponsorship },
        { href: p('/contact'), label: dict.nav.contact },
      ],
    },
    {
      title: dict.footer.legal,
      links: [
        { href: p('/privacy'), label: dict.nav.privacy },
        { href: p('/terms'), label: dict.nav.terms },
        { href: '/rss.xml', label: dict.footer.rss },
      ],
    },
  ];

  return (
    <footer className="mt-32 border-t border-line">
      <div className="container-page grid gap-14 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)] md:py-20">
        <div className="space-y-5">
          <Logo className="h-12 w-auto" title={dict.meta.siteName} />
          <p className="display text-2xl">{dict.meta.tagline}</p>
          {social.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-2 text-sm text-muted" aria-label={dict.footer.follow}>
              {social.map((s) => (
                <li key={s.key}>
                  <a href={s.url} rel="noopener noreferrer me" target="_blank" className="hover:text-fg">
                    {SOCIAL_LABELS[s.key]}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="mb-4 text-sm text-muted">{column.title}</h2>
            <ul className="space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith('/rss') ? (
                    <a href={link.href} className="hover:text-accent">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="hover:text-accent">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="container-page flex flex-col gap-2 border-t border-line py-6 text-sm text-muted sm:flex-row sm:justify-between">
        <p>{t(dict.footer.rights, { year: new Date().getFullYear() })}</p>
        <p>{dict.footer.madeIn}</p>
      </div>
    </footer>
  );
}
