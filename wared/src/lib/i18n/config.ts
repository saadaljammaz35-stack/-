export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ar';

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'ar' || value === 'en';
}

export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'ar' ? 'en' : 'ar';
}

/** Picks the localized value, falling back to Arabic (the source language of وارد content). */
export function pick<T extends string | null | undefined>(locale: Locale, ar: T, en: T | null | undefined): T {
  if (locale === 'en' && en) return en;
  return ar;
}

/** True when an English page has to show Arabic content because no translation exists. */
export function isFallback(locale: Locale, en: string | null | undefined): boolean {
  return locale === 'en' && !en;
}

export function localePath(locale: Locale, path = ''): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`;
}
