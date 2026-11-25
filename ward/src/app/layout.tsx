import type { Metadata, Viewport } from 'next';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import './ward-type.css';
import './globals.css';
import { getPrefs } from '@/lib/prefs';

export const metadata: Metadata = {
  title: { default: 'وارد — كل شيء وارد.', template: '%s · وارد' },
  description: 'وارد: منصة إعلامية سعودية ناشئة للحوارات والقصص والأفكار.',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2EFE8' },
    { media: '(prefers-color-scheme: dark)', color: '#171717' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, theme } = await getPrefs();
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} data-theme={theme === 'system' ? undefined : theme} suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/WARDTypeOriginal-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/WARDTypeOriginal-Black.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
