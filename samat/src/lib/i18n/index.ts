import { ar, type Dict } from './ar';
import { en } from './en';
import type { Locale } from '@/lib/money';

export type { Dict, Locale };
export const LOCALE_COOKIE = 'samat_lang';
export const dictionaries: Record<Locale, Dict> = { ar, en };

export function isLocale(v: unknown): v is Locale {
  return v === 'ar' || v === 'en';
}

/** Replace {name} placeholders. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function dir(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** Pick the localized value of a bilingual DB row: name_ar / name_en. */
export function pick<T extends Record<string, unknown>>(row: T, field: string, locale: Locale): string {
  const v = row[`${field}_${locale}`] ?? row[`${field}_ar`] ?? row[`${field}_en`];
  return typeof v === 'string' ? v : '';
}
