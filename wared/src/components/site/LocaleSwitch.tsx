'use client';

import { usePathname } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import { otherLocale } from '@/lib/i18n/config';

/** Switches language on the same page. A full navigation is expected: each language has its own root layout. */
export function LocaleSwitch({ className = '' }: { className?: string }) {
  const pathname = usePathname();
  const { locale, dict } = useI18n();
  const target = otherLocale(locale);
  const href = pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${target}`) || `/${target}`;
  return (
    <a
      href={href}
      hrefLang={target}
      lang={target}
      aria-label={dict.nav.switchLanguageLabel}
      onClick={() => {
        document.cookie = `wared_locale=${target}; path=/; max-age=31536000; samesite=lax`;
      }}
      className={`inline-flex h-11 items-center rounded-full px-3 text-sm font-medium transition-colors hover:bg-surface ${className}`}
    >
      {dict.nav.switchLanguage}
    </a>
  );
}
