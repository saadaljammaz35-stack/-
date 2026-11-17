import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DevSettings, I18nManager, Platform } from 'react-native';

import ar from './ar';
import en from './en';

export type Lang = 'ar' | 'en';

void i18n.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: 'ar',
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export const isRtlLang = (lang: Lang) => lang === 'ar';

/** Applies the language. Returns true when native layout direction needs an app restart. */
export function applyLanguage(lang: Lang): boolean {
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
  const rtl = isRtlLang(lang);
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
    return false;
  }
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
    return true;
  }
  return false;
}

/** Restarts the JS app so a new layout direction takes effect (works in release builds). */
export async function restartForDirection(): Promise<void> {
  try {
    const { reloadAppAsync } = await import('expo');
    await reloadAppAsync('language direction changed');
  } catch {
    if (__DEV__) DevSettings.reload();
  }
}

/** Relative time ("قبل ٣ ساعات") using the platform's Intl data. */
export function relativeTime(iso: string | null | undefined, lang: Lang, now = Date.now()): string {
  if (!iso) return '';
  const diff = (Date.parse(iso) - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return i18n.t('time.justNow');
  try {
    const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en', { numeric: 'auto' });
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
      ['year', 31536000],
      ['month', 2592000],
      ['week', 604800],
      ['day', 86400],
      ['hour', 3600],
      ['minute', 60],
    ];
    for (const [unit, secs] of units) if (abs >= secs) return rtf.format(Math.round(diff / secs), unit);
  } catch {
    // Intl not available: fall back to the date
  }
  return formatDate(iso, lang);
}

export function formatDate(iso: string, lang: Lang): string {
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export default i18n;
