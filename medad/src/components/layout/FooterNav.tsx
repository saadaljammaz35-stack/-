'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Dictionary } from '@/content/types';
import type { Locale } from '@/lib/i18n';
import { NAV_ITEMS, NavAnchor } from './NavAnchor';

export function FooterLink({
  locale,
  hash,
  className,
  children,
}: {
  locale: Locale;
  hash: string;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <NavAnchor locale={locale} hash={hash} isHome={pathname === `/${locale}`} className={className}>
      {children}
    </NavAnchor>
  );
}

export function FooterNav({
  locale,
  labels,
  ariaLabel,
}: {
  locale: Locale;
  labels: Dictionary['nav'];
  ariaLabel: string;
}) {
  return (
    <nav aria-label={ariaLabel}>
      <ul className="flex flex-col gap-3 text-[0.95rem]">
        {NAV_ITEMS.map((item) => (
          <li key={item.key}>
            <FooterLink locale={locale} hash={item.hash} className="text-cool transition-colors hover:text-white">
              {labels[item.key]}
            </FooterLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

