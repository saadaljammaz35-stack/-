'use client';
import { createContext, useCallback, useContext, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { dictionaries, LOCALE_COOKIE, type Dict, type Locale } from './index';

type Ctx = { locale: Locale; t: Dict; setLocale: (l: Locale) => void; switching: boolean };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const [switching, start] = useTransition();
  const setLocale = useCallback(
    (l: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = l;
      document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
      start(() => router.refresh());
    },
    [router],
  );
  return (
    <I18nContext.Provider value={{ locale, t: dictionaries[locale], setLocale, switching }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}
