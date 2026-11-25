'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { CloseIcon, MenuIcon } from '@/components/ui/icons';
import { LocaleSwitch } from './LocaleSwitch';
import { ThemeToggle } from './ThemeToggle';

export function MobileMenu({ links, secondary }: { links: { href: string; label: string }[]; secondary: { href: string; label: string }[] }) {
  const { dict } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  // Close after navigating.
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="grid size-11 place-items-center rounded-full hover:bg-surface lg:hidden"
        aria-label={dict.nav.menu}
        aria-haspopup="dialog"
      >
        <MenuIcon size={22} />
      </button>
      <dialog
        ref={dialogRef}
        aria-label={dict.nav.menu}
        className="wared-menu m-0 h-dvh max-h-none w-full max-w-none bg-bg p-0 text-fg backdrop:bg-ink/40"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="container-page flex min-h-full flex-col pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">{dict.nav.menu}</span>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="grid size-11 place-items-center rounded-full hover:bg-surface"
              aria-label={dict.nav.closeMenu}
              autoFocus
            >
              <CloseIcon size={22} />
            </button>
          </div>
          <nav className="mt-8 flex-1" aria-label={dict.nav.menu}>
            <ul className="space-y-1">
              {links.map((link, i) => (
                <li key={link.href} style={{ ['--i' as string]: i }} className="wared-menu-item">
                  <Link
                    href={link.href}
                    aria-current={pathname === link.href ? 'page' : undefined}
                    className="display block py-2 text-[2.5rem] leading-tight aria-[current=page]:text-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-3 text-muted">
              {secondary.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-fg">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-10 flex items-center gap-2 border-t border-line pt-4">
            <ThemeToggle />
            <LocaleSwitch />
          </div>
        </div>
      </dialog>
    </>
  );
}
