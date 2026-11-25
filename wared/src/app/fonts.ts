import localFont from 'next/font/local';

/** IBM Plex Sans Arabic (SIL OFL 1.1): interface, headings and English text. */
export const plex = localFont({
  src: [
    { path: './fonts/IBMPlexSansArabic-Light.woff2', weight: '300', style: 'normal' },
    { path: './fonts/IBMPlexSansArabic-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/IBMPlexSansArabic-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/IBMPlexSansArabic-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-plex',
  display: 'swap',
  fallback: ['Tahoma', 'system-ui', 'sans-serif'],
});

/** Noto Naskh Arabic (SIL OFL 1.1): long-form reading text. */
export const naskh = localFont({
  src: './fonts/NotoNaskhArabic.woff2',
  weight: '400 700',
  variable: '--font-naskh',
  display: 'swap',
  preload: false,
  fallback: ['serif'],
});

/**
 * WARD TYPE: the brand display face. Only used for headlines when site_settings.brand.display_font is
 * "ward". The browser downloads it only when a page actually uses it. Replace ./fonts/ward-type.ttf with a
 * corrected build before switching it on (see README).
 */
export const wardType = localFont({
  src: './fonts/ward-type.ttf',
  weight: '700',
  variable: '--font-ward',
  display: 'swap',
  preload: false,
});
