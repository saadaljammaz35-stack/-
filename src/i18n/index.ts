// Bilingual UI strings: every label is written inline as (Arabic, English) so the two
// languages never drift apart. Religious content is always shown in Arabic.
import { useMemo } from 'react';

import { useSettings, type Language } from '@/store/settings';

export function translate(lang: Language, ar: string, en: string): string {
  return lang === 'en' ? en : ar;
}

export function useI18n() {
  const lang = useSettings((s) => s.language);
  // Memoised so `tr` can be used in effect dependencies.
  return useMemo(
    () => ({
      lang,
      isRTL: lang === 'ar',
      tr: (ar: string, en: string) => translate(lang, ar, en),
    }),
    [lang],
  );
}
