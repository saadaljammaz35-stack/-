import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import { I18nProvider } from '@/components/I18nProvider';
import { MotionProvider } from '@/components/MotionProvider';
import { PlayerBar, PlayerSpacer } from '@/components/player/PlayerBar';
import { PlayerProvider } from '@/components/player/PlayerProvider';
import { DemoBanner } from '@/components/site/blocks';
import { PageViewTracker } from '@/components/site/PageViewTracker';
import { ServiceWorker } from '@/components/site/ServiceWorker';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { ThemeScript } from '@/components/ThemeScript';
import { getSiteSettings } from '@/lib/data/public';
import { publicEnv } from '@/lib/env';
import { dirFor, getDictionary, isLocale, locales } from '@/lib/i18n';
import { jsonLdString, organizationJsonLd, websiteJsonLd } from '@/lib/seo';
import { naskh, plex, wardType } from '../fonts';
import '../globals.css';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}


export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    applicationName: dict.meta.siteName,
    title: { default: `${dict.meta.siteName} | ${dict.meta.tagline}`, template: `%s` },
    description: dict.meta.description,
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, title: dict.meta.siteName, statusBarStyle: 'black-translucent' },
    formatDetection: { telephone: false },
    alternates: { types: { 'application/rss+xml': [{ url: '/rss.xml', title: dict.meta.siteName }] } },
    robots: publicEnv.demoContent ? { index: false, follow: false } : undefined,
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2EFE8' },
    { media: '(prefers-color-scheme: dark)', color: '#171717' },
  ],
};

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const settings = await getSiteSettings();
  const displayFont = settings.brand.display_font === 'plex' ? { ['--font-display-face' as string]: 'var(--font-plex)' } : undefined;

  return (
    <html
      lang={locale === 'ar' ? 'ar-SA' : 'en'}
      dir={dirFor(locale)}
      className={`${plex.variable} ${naskh.variable} ${wardType.variable}`}
      style={displayFont as CSSProperties | undefined}
      suppressHydrationWarning
    >
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString([organizationJsonLd(), websiteJsonLd(locale)]) }} />
      </head>
      <body className="min-h-dvh">
        <MotionProvider>
        <I18nProvider locale={locale} dict={dict}>
          <PlayerProvider>
            {publicEnv.demoContent && <DemoBanner dict={dict} />}
            <SiteHeader locale={locale} dict={dict} />
            <main id="main" tabIndex={-1} className="outline-none">
              {children}
            </main>
            <SiteFooter locale={locale} dict={dict} settings={settings} />
            <PlayerSpacer />
            <PlayerBar />
            <PageViewTracker locale={locale} />
            <ServiceWorker />
          </PlayerProvider>
        </I18nProvider>
        </MotionProvider>
        <ThemeScript />
      </body>
    </html>
  );
}
