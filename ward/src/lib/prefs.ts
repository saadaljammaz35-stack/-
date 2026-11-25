import 'server-only';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, THEME_COOKIE, type Locale } from '@/lib/i18n';

export type Theme = 'light' | 'dark' | 'system';

export async function getPrefs(): Promise<{ locale: Locale; theme: Theme; sidebarCollapsed: boolean }> {
  const jar = await cookies();
  const locale: Locale = jar.get(LOCALE_COOKIE)?.value === 'en' ? 'en' : 'ar';
  const t = jar.get(THEME_COOKIE)?.value;
  const theme: Theme = t === 'light' || t === 'dark' ? t : 'system';
  return { locale, theme, sidebarCollapsed: jar.get('ward_sidebar')?.value === 'collapsed' };
}
