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
 * WARD TYPE 2.0: the brand display face for headlines (a condensed adaptation of Noto Kufi Arabic, SIL OFL 1.1;
 * see licenses/WARD-TYPE-OFL.txt). Covers Arabic and Latin. Body text stays in IBM Plex Sans Arabic.
 */
export const wardType = localFont({
  src: [
    { path: './fonts/WARDTYPE-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/WARDTYPE-Bold.woff2', weight: '700', style: 'normal' },
    { path: './fonts/WARDTYPE-Black.woff2', weight: '900', style: 'normal' },
  ],
  variable: '--font-ward',
  display: 'swap',
  fallback: ['IBM Plex Sans Arabic', 'Tahoma', 'sans-serif'],
});
