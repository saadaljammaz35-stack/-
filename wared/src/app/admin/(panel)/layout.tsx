import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminNav, type NavItem } from '@/components/admin/AdminNav';
import { Logo } from '@/components/site/Logo';
import { ThemeToggleStandalone } from '@/components/admin/ThemeToggleStandalone';
import { signOut } from '@/lib/admin/actions/manage';
import { can, requireStaff } from '@/lib/admin/auth';
import { ROLE_LABELS, type Permission } from '@/lib/admin/permissions';

const NAV: (NavItem & { permission?: Permission })[] = [
  { href: '/admin', label: 'نظرة عامة', group: 'عام' },
  { href: '/admin/analytics', label: 'الإحصائيات', group: 'عام', permission: 'analytics.read' },
  { href: '/admin/episodes', label: 'الحلقات', group: 'المحتوى', permission: 'content.edit_any' },
  { href: '/admin/programs', label: 'البرامج', group: 'المحتوى', permission: 'content.edit_any' },
  { href: '/admin/articles', label: 'القصص والمقالات', group: 'المحتوى', permission: 'content.create' },
  { href: '/admin/guests', label: 'الضيوف', group: 'المحتوى', permission: 'content.edit_any' },
  { href: '/admin/clips', label: 'المقاطع القصيرة', group: 'المحتوى', permission: 'content.edit_any' },
  { href: '/admin/categories', label: 'التصنيفات', group: 'المحتوى', permission: 'content.edit_any' },
  { href: '/admin/media', label: 'مكتبة الوسائط', group: 'المحتوى', permission: 'media.upload' },
  { href: '/admin/messages', label: 'رسائل التواصل', group: 'الجمهور', permission: 'inbox.manage' },
  { href: '/admin/sponsorships', label: 'طلبات الرعاية', group: 'الجمهور', permission: 'inbox.manage' },
  { href: '/admin/subscribers', label: 'مشتركو النشرة', group: 'الجمهور', permission: 'subscribers.manage' },
  { href: '/admin/users', label: 'المستخدمون والصلاحيات', group: 'الإدارة', permission: 'users.manage' },
  { href: '/admin/settings', label: 'إعدادات الموقع', group: 'الإدارة', permission: 'settings.manage' },
  { href: '/admin/audit', label: 'سجل العمليات', group: 'الإدارة', permission: 'audit.read' },
  { href: '/admin/account', label: 'حسابي', group: 'الإدارة' },
];

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  const items = NAV.filter((item) => !item.permission || can(staff, item.permission)).map(({ href, label, group }) => ({ href, label, group }));
  return (
    <div className="mx-auto grid min-h-dvh max-w-[96rem] lg:grid-cols-[17rem_1fr]">
      <aside className="border-line px-4 pb-4 pt-5 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-e lg:px-5 lg:py-8">
        <div className="mb-5 flex items-center justify-between lg:mb-10">
          <Link href="/admin" aria-label="لوحة التحكم">
            <Logo className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggleStandalone />
            <a href="/ar" className="rounded-full px-3 py-2 text-sm text-muted hover:text-fg" target="_blank" rel="noopener">
              الموقع ↗
            </a>
          </div>
        </div>
        <AdminNav items={items} />
        <div className="mt-8 hidden border-t border-line pt-5 text-sm lg:block">
          <p className="font-medium">{staff.fullName || staff.email}</p>
          <p className="mt-0.5 text-muted">{ROLE_LABELS[staff.role]}</p>
          <form action={signOut} className="mt-3">
            <button type="submit" className="text-muted underline hover:text-fg">
              تسجيل الخروج
            </button>
          </form>
        </div>
      </aside>
      <main id="main" className="min-w-0 px-4 pb-24 pt-4 sm:px-6 lg:px-12 lg:pt-10">
        {children}
      </main>
    </div>
  );
}
