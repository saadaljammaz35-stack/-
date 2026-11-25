import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { themeScript } from '@/components/site/ThemeToggle';
import { naskh, plex } from '../fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: { default: 'لوحة تحكم وارد', template: '%s | لوحة تحكم وارد' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#171717' };

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${plex.variable} ${naskh.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
