'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import {
  Bell, Bot, ChefHat, ClipboardList, Cog, Gift, LayoutDashboard, LogOut, Menu as MenuIcon, Monitor, Package, QrCode, ScrollText,
  Soup, Store, Tag, UtensilsCrossed, Users, Warehouse, X,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { useAdmin } from '@/lib/i18n/admin-client';
import { browserDb } from '@/lib/supabase/browser';
import { Logo } from '@/components/brand/Logo';

const ITEMS = [
  { href: '/admin', key: 'dashboard', icon: LayoutDashboard, perm: 'dashboard.view' },
  { href: '/admin/orders', key: 'orders', icon: ClipboardList, perm: 'orders.view' },
  { href: '/admin/pickup', key: 'pickup', icon: QrCode, perm: 'pickup.verify' },
  { href: '/kitchen', key: 'kitchen', icon: ChefHat, perm: 'kitchen.view' },
  { href: '/admin/ai', key: 'ai', icon: Bot, perm: 'ai.use' },
  { href: '/admin/menu', key: 'products', icon: UtensilsCrossed, perm: 'menu.manage' },
  { href: '/admin/menu/ingredients', key: 'ingredients', icon: Package, perm: 'menu.manage' },
  { href: '/admin/menu/sauces', key: 'sauces', icon: Soup, perm: 'menu.manage' },
  { href: '/admin/inventory', key: 'inventory', icon: Warehouse, perm: 'inventory.manage' },
  { href: '/admin/coupons', key: 'coupons', icon: Tag, perm: 'coupons.manage' },
  { href: '/admin/loyalty', key: 'loyalty', icon: Gift, perm: 'loyalty.manage' },
  { href: '/admin/staff', key: 'staff', icon: Users, perm: 'staff.manage' },
  { href: '/admin/settings', key: 'settings', icon: Cog, perm: 'settings.manage' },
  { href: '/admin/notifications', key: 'notifications', icon: Bell, perm: 'notifications.view' },
  { href: '/admin/audit', key: 'audit', icon: ScrollText, perm: 'audit.view' },
  { href: '/pickup-screen', key: 'pickupScreen', icon: Monitor, perm: 'orders.view' },
] as const;

export function AdminShell({ children, perms, email, role }: { children: ReactNode; perms: string[]; email: string; role: string }) {
  const { a } = useAdmin();
  const { locale, setLocale } = useI18n();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = ITEMS.filter((i) => perms.includes(i.perm));
  const isActive = (href: string) => (href === '/admin' ? path === '/admin' : path === href || (path.startsWith(href + '/') && !(href === '/admin/menu' && /ingredients|sauces/.test(path))));

  const nav = (
    <nav className="space-y-0.5" aria-label={a.title}>
      {items.map((i) => (
        <Link key={i.href} href={i.href} onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive(i.href) ? 'bg-cream-100 text-espresso-900 shadow-soft' : 'text-cream-200/80 hover:bg-cream-100/10 hover:text-cream-100'}`}>
          <i.icon className="size-[18px] shrink-0" /> {a.nav[i.key]}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="space-y-2 border-t border-cream-100/10 pt-4 text-cream-200">
      <p className="truncate text-xs text-cream-200/60" dir="ltr">{email}</p>
      <p className="text-xs font-semibold text-gold-400">{a.role[role as keyof typeof a.role]}</p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-sm flex-1 border border-cream-100/20" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>{locale === 'ar' ? 'English' : 'العربية'}</button>
        <Link href="/" className="btn btn-sm border border-cream-100/20" aria-label={a.nav.store}><Store className="size-4" /></Link>
        <button type="button" className="btn btn-sm border border-cream-100/20" aria-label={a.nav.signOut}
          onClick={async () => { await browserDb().auth.signOut(); router.replace('/admin/login'); }}><LogOut className="size-4" /></button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto bg-espresso-900 p-4 lg:flex">
        <Link href="/admin" className="flex items-center gap-2 px-2 pt-2 text-cream-100"><Logo variant="icon" height={34} /><Logo variant="wordmark" height={30} /></Link>
        <div className="flex-1">{nav}</div>
        {footer}
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-espresso-900 px-4 py-3 text-cream-100 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2"><Logo variant="icon" height={28} /><span className="font-bold">{a.title}</span></Link>
        <button type="button" className="btn btn-sm border border-cream-100/20" onClick={() => setOpen(true)} aria-label="menu"><MenuIcon className="size-5" /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 start-0 flex w-72 flex-col gap-5 overflow-y-auto bg-espresso-900 p-4">
            <div className="flex items-center justify-between text-cream-100"><Logo variant="wordmark" height={28} /><button type="button" onClick={() => setOpen(false)} aria-label="close"><X /></button></div>
            <div className="flex-1">{nav}</div>
            {footer}
          </div>
        </div>
      )}
      <main id="main" className="min-w-0 px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
