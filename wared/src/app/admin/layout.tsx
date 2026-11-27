import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ThemeScript } from '@/components/ThemeScript';
import { naskh, plex, wardType } from '../fonts';
import '../globals.css';

/** Admin pages are always rendered per request and never cached. */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'لوحة تحكم وارد', template: '%s | لوحة تحكم وارد' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#171717' };

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${plex.variable} ${naskh.variable} ${wardType.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh">
        {children}
        <ThemeScript />
      </body>
    </html>
  );
}
