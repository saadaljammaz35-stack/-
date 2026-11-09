import type { Metadata } from 'next';
import Link from 'next/link';
import localFont from 'next/font/local';
import './globals.css';
import { MARK_PATH, MARK_VIEWBOX } from '@/components/brand/paths';

const plexArabic = localFont({
  src: [
    { path: './fonts/plex-arabic-400.woff2', weight: '400' },
    { path: './fonts/plex-arabic-600.woff2', weight: '600' },
  ],
  variable: '--font-plex-arabic',
  display: 'swap',
});
const manrope = localFont({
  src: './fonts/manrope-latin-var.woff2',
  variable: '--font-manrope',
  weight: '200 800',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '404 | مِداد — MEDAD',
  description: 'الصفحة غير موجودة — Page not found.',
  robots: { index: false },
};

/** 404 for URLs outside /ar and /en (the root layout lives under [lang]). */
export default function GlobalNotFound() {
  return (
    <html lang="ar" dir="rtl" className={`${plexArabic.variable} ${manrope.variable}`}>
      <body>
        <main className="relative isolate grid min-h-svh place-items-center overflow-hidden px-6 text-center">
          <div aria-hidden="true" className="absolute top-1/2 left-1/2 -z-10 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(65_105_255/0.25),transparent)]" />
          <div className="flex flex-col items-center">
            <svg viewBox={MARK_VIEWBOX} className="h-16 w-auto text-white/80" aria-hidden="true">
              <path fill="currentColor" fillRule="evenodd" d={MARK_PATH} />
            </svg>
            <p className="mt-10 font-latin text-xs tracking-[0.3em] text-icy">404</p>
            <h1 className="mt-4 text-h2">هذه الصفحة لم تُكتب بعد.</h1>
            <p className="mt-4 text-lead text-cool" lang="en" dir="ltr">
              This page hasn’t been written yet.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href="/ar" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-obsidian">
                الصفحة الرئيسية
              </Link>
              <Link href="/en" lang="en" className="rounded-full border border-white/15 px-6 py-3 font-latin text-sm text-white">
                Home
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
