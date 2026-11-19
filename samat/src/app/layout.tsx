import type { Metadata, Viewport } from 'next';
import { Readex_Pro } from 'next/font/google';
import { getDict } from '@/lib/i18n/server';
import { dir } from '@/lib/i18n';
import { I18nProvider } from '@/lib/i18n/client';
import './globals.css';

const readex = Readex_Pro({ subsets: ['arabic', 'latin'], variable: '--font-readex', display: 'swap' });

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

export const viewport: Viewport = {
  themeColor: [{ color: '#2f231c' }],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getDict();
  return (
    <html lang={locale} dir={dir(locale)} className={readex.variable} suppressHydrationWarning>
      <body className="min-h-dvh">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
