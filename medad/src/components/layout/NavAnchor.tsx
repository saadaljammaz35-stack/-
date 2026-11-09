'use client';

import Link from 'next/link';
import type { Locale } from '@/lib/i18n';

export type NavKey = 'home' | 'services' | 'work' | 'about' | 'contact';
export const NAV_ITEMS: { key: NavKey; hash: string; sections: string[] }[] = [
  { key: 'home', hash: 'top', sections: ['top'] },
  { key: 'services', hash: 'services', sections: ['services'] },
  { key: 'work', hash: 'work', sections: ['work'] },
  { key: 'about', hash: 'about', sections: ['about', 'process', 'why'] },
  { key: 'contact', hash: 'contact', sections: ['contact', 'start'] },
];

/** Plain in-page anchor on the home page, client-side link elsewhere. */
export function NavAnchor({
  locale,
  hash,
  isHome,
  className,
  children,
  onClick,
  ...rest
}: {
  locale: Locale;
  hash: string;
  isHome: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  'aria-current'?: 'page' | 'location' | undefined;
}) {
  if (isHome) {
    return (
      <a href={`#${hash}`} className={className} onClick={onClick} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={hash === 'top' ? `/${locale}` : `/${locale}#${hash}`} className={className} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}

