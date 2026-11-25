import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Arabic, Readex_Pro } from 'next/font/google';
import { getDict } from '@/lib/i18n/server';
import { dir } from '@/lib/i18n';
import { I18nProvider } from '@/lib/i18n/client';
import { vapidKeys } from '@/lib/notify/vapid';
import { getDesign } from '@/lib/design';
import './globals.css';

const readex = Readex_Pro({ subsets: ['arabic', 'latin'], variable: '--font-readex', display: 'swap' });
/* studio design: Apple devices use the system font (SF Arabic); everyone else gets IBM Plex Sans Arabic */
const plex = IBM_Plex_Sans_Arabic({ subsets: ['arabic', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex', display: 'swap', preload: false });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return {
    metadataBase: new URL(site),
    title: { default: t.meta.title, template: `%s — ${t.common.brand}` },
    description: t.meta.description,
    applicationName: 'SAMAT',
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/brand/samat-icon.svg', type: 'image/svg+xml' }],
      apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    },
    appleWebApp: { capable: true, title: 'SAMAT', statusBarStyle: 'black-translucent' },
    openGraph: { title: t.meta.title, description: t.meta.description, images: ['/media/og.jpg'], type: 'website' },
    formatDetection: { telephone: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  return {
    themeColor: [{ color: (await getDesign()) === 'studio' ? '#ffffff' : '#2f231c' }],
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getDict();
  const pushKey = vapidKeys()?.publicKey;
  return (
    <html lang={locale} dir={dir(locale)} className={`${readex.variable} ${plex.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh">
        {pushKey && <meta name="samat-push-key" content={pushKey} />}
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
