import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { notFound } from 'next/navigation';
import '../globals.css';
import { getDictionary } from '@/content';
import { getSiteUrl, siteConfig, activeSocial } from '@/config/site';
import { dirOf, isLocale, locales, type Locale } from '@/lib/i18n';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Intro } from '@/components/layout/Intro';
import { RevealObserver } from '@/components/motion/RevealObserver';
import { SmoothScroll } from '@/components/motion/SmoothScroll';
import { Cursor } from '@/components/motion/Cursor';
import { LangTransition } from '@/components/layout/LangTransition';

const plexArabic = localFont({
  src: [
    { path: '../fonts/plex-arabic-400.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/plex-arabic-500.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/plex-arabic-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-plex-arabic',
  display: 'swap',
  fallback: ['Tahoma', 'Arial', 'sans-serif'],
});

const manrope = localFont({
  src: '../fonts/manrope-latin-var.woff2',
  variable: '--font-manrope',
  weight: '200 800',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const viewport: Viewport = {
  themeColor: '#080A0F',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang);
  return {
    metadataBase: getSiteUrl(),
    title: { default: t.meta.title, template: `%s | ${lang === 'ar' ? 'مِداد' : 'MEDAD'}` },
    description: t.meta.description,
    keywords: t.meta.keywords,
    applicationName: 'MEDAD',
    alternates: {
      canonical: `/${lang}`,
      languages: { ar: '/ar', en: '/en', 'x-default': '/ar' },
    },
    openGraph: {
      type: 'website',
      siteName: 'MEDAD | مِداد',
      title: t.meta.title,
      description: t.meta.description,
      locale: lang === 'ar' ? 'ar_SA' : 'en_US',
      alternateLocale: lang === 'ar' ? ['en_US'] : ['ar_SA'],
      url: `/${lang}`,
      images: [{ url: '/og.png', width: 1200, height: 630, alt: t.meta.ogAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t.meta.title,
      description: t.meta.description,
      images: ['/og.png'],
    },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

// Runs before first paint: enables JS-only reveal states and decides whether
// the opening sequence plays (once per session, never with reduced motion).
const bootScript = `(function(){var d=document.documentElement;d.classList.add('js');try{var r=window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(r||sessionStorage.getItem('medad-intro')){d.setAttribute('data-intro','skip')}else{d.setAttribute('data-intro','play');sessionStorage.setItem('medad-intro','1')}}catch(e){d.setAttribute('data-intro','skip')}})();`;

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale: Locale = lang;
  const t = getDictionary(locale);
  const url = getSiteUrl().toString().replace(/\/$/, '');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MEDAD',
    alternateName: 'مِداد',
    url,
    logo: `${url}/brand/mark.svg`,
    slogan: 'Digital Experiences. Designed to Matter.',
    description: t.meta.description,
    ...(siteConfig.email ? { email: siteConfig.email } : {}),
    ...(activeSocial().length ? { sameAs: activeSocial().map((s) => s.url) } : {}),
  };

  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      className={`${plexArabic.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      </head>
      <body>
        <a
          href="#main"
          className="fixed top-3 z-[110] -translate-y-24 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-obsidian transition-transform focus:translate-y-0 ltr:left-3 rtl:right-3"
        >
          {t.a11y.skip}
        </a>
        <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="ink-rule" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#4169FF" />
              <stop offset="0.6" stopColor="#9DB8FF" stopOpacity="0.5" />
              <stop offset="1" stopColor="#9DB8FF" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <Intro label={t.hero.metaEnd} />
        <Navbar locale={locale} t={{ nav: t.nav, a11y: t.a11y, tagline: t.footer.tagline }} />
        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>
        <Footer locale={locale} t={t} />
        <div className="grain" aria-hidden="true" />
        <LangTransition />
        <RevealObserver />
        <SmoothScroll />
        <Cursor />
      </body>
    </html>
  );
}
