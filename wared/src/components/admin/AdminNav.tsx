'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
  group: string;
}

export function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const groups = [...new Set(items.map((i) => i.group))];
  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`));
  const list = (
    <div className="space-y-7">
      {groups.map((group) => (
        <div key={group}>
          <p className="mb-2 px-3 text-xs text-muted">{group}</p>
          <ul className="space-y-0.5">
            {items
              .filter((i) => i.group === group)
              .map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className="block rounded-xl px-3 py-2.5 text-[0.9375rem] transition-colors hover:bg-surface aria-[current=page]:bg-fg aria-[current=page]:text-bg"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
  return (
    <>
      <nav aria-label="لوحة التحكم" className="hidden lg:block">
        {list}
      </nav>
      <details className="group lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl border border-line px-4">
          <span>{items.find((i) => isActive(i.href))?.label ?? 'القائمة'}</span>
          <span aria-hidden="true" className="transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <nav aria-label="لوحة التحكم" className="mt-3 rounded-2xl border border-line p-3">
          {list}
        </nav>
      </details>
    </>
  );
}
