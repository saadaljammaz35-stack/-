import type { Locale } from '@/lib/i18n';
import { ar } from './ar';
import { en } from './en';
import type { Dictionary, ServiceSlug } from './types';

const dictionaries: Record<Locale, Dictionary> = { ar, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export const serviceSlugs: ServiceSlug[] = ar.services.items.map((s) => s.slug);

export function isServiceSlug(value: string): value is ServiceSlug {
  return (serviceSlugs as string[]).includes(value);
}

export type { Dictionary } from './types';
