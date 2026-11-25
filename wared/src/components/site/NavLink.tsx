'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="relative rounded-full px-3.5 py-2 text-[0.9375rem] text-muted transition-colors hover:text-fg aria-[current=page]:text-fg"
    >
      {children}
      {active && <span className="absolute inset-x-3.5 -bottom-[1px] h-px bg-sand" aria-hidden="true" />}
    </Link>
  );
}
