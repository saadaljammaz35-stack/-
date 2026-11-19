'use client';
import { useI18n } from './client';
import { adminDicts, type AdminDict } from './admin';

export function useAdmin(): { a: AdminDict; locale: 'ar' | 'en' } {
  const { locale } = useI18n();
  return { a: adminDicts[locale] as AdminDict, locale };
}
