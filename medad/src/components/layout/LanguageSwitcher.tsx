'use client';

import { motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/lib/i18n';
import { switchLanguage } from './LangTransition';

const SECTIONS = ['top', 'about', 'services', 'work', 'process', 'why', 'contact'];

/** The section currently in view, so switching language keeps your place. */
function currentSection(): string | null {
  let current: string | null = null;
  for (const id of SECTIONS) {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) current = id;
  }
  return current && current !== 'top' ? current : null;
}

export function LanguageSwitcher({
  locale,
  label,
  className = '',
  layoutId = 'lang-pill',
}: {
  locale: Locale;
  label: string;
  className?: string;
  layoutId?: string;
}) {
  const pathname = usePathname() || `/${locale}`;
  const rest = pathname.replace(/^\/(ar|en)(?=\/|$)/, '');
  const options: { code: Locale; text: string }[] = [
    { code: 'ar', text: 'ع' },
    { code: 'en', text: 'EN' },
  ];

  return (
    <div
      className={`relative flex h-10 items-center rounded-full border border-white/10 bg-white/[0.04] p-1 ${className}`}
      dir="ltr"
    >
      {options.map((o) => {
        const active = o.code === locale;
        const href = `/${o.code}${rest}`;
        return active ? (
          <span
            key={o.code}
            aria-current="true"
            lang={o.code}
            className={`relative z-10 grid h-8 min-w-9 place-items-center px-2.5 text-[0.8rem] font-semibold text-obsidian ${o.code === 'en' ? 'font-latin' : 'font-arabic'}`}
          >
            <motion.span
              layoutId={layoutId}
              className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_4px_18px_-4px_rgb(157_184_255/0.7)]"
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            />
            {o.text}
          </span>
        ) : (
          <a
            key={o.code}
            href={href}
            hrefLang={o.code}
            lang={o.code}
            aria-label={label}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              const section = rest === '' ? currentSection() : null;
              switchLanguage(section ? `${href}#${section}` : href);
            }}
            className={`relative z-10 grid h-8 min-w-9 place-items-center rounded-full px-2.5 text-[0.8rem] font-semibold text-cool transition-colors hover:text-white ${o.code === 'en' ? 'font-latin' : 'font-arabic'}`}
          >
            {o.text}
          </a>
        );
      })}
    </div>
  );
}
