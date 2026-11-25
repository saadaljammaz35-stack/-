import { ar, type Dictionary } from './dictionaries/ar';
import { en } from './dictionaries/en';
import type { Locale } from './config';

export type { Dictionary };
export * from './config';

const dictionaries: Record<Locale, Dictionary> = { ar, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Replaces {name} placeholders. */
export function t(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** Resolves the `[locale]` route param (the proxy guarantees it is valid; fall back to Arabic just in case). */
export async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  return locale === 'en' ? 'en' : 'ar';
}
