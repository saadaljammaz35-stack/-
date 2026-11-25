import Link from 'next/link';
import { AdminHeader, formatAdminDate, Notice, NotConfigured } from '@/components/admin/ui';
import { can, requireStaff } from '@/lib/admin/auth';
import { analyticsOverview, count, listTable } from '@/lib/admin/queries';
import { isSupabaseConfigured } from '@/lib/env';
import { isEmailConfigured, serverEnv } from '@/lib/server-env';

export const metadata = { title: 'نظرة عامة' };

const fmt = new Intl.NumberFormat('ar-SA-u-nu-latn');

function Tile({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link href={href} className="rounded-2xl border border-line p-5 transition-colors hover:border-line-strong">
      <p className="text-sm text-muted">{label}</p>
      <p className="display mt-2 text-4xl tabular-nums">{fmt.format(value)}</p>
    </Link>
  );
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const staff = await requireStaff();
  const { denied } = await searchParams;
  const configured = isSupabaseConfigured();
  const [drafts, review, scheduled, newMessages, newSponsors, subscribers, stats, audit] = await Promise.all([
    can(staff, 'content.read_all') ? count('episodes', { status: 'draft' }) : 0,
    can(staff, 'content.read_all') ? count('articles', { status: 'review' }) : 0,
    can(staff, 'content.read_all') ? count('episodes', { status: 'scheduled' }) : 0,
    can(staff, 'inbox.manage') ? count('contact_messages', { status: 'new' }) : 0,
    can(staff, 'inbox.manage') ? count('sponsorship_requests', { status: 'new' }) : 0,
    can(staff, 'subscribers.manage') ? count('subscribers', { status: 'active' }) : 0,
    can(staff, 'analytics.read') ? analyticsOverview(7) : null,
    can(staff, 'audit.read') ? listTable('audit_logs', 'id, action, entity_type, summary, actor_email, created_at', { order: 'created_at', limit: 8 }) : [],
  ]);

  const setup = [
    { done: configured, text: 'ربط Supabase (الرابط والمفتاح العام)' },
    { done: Boolean(serverEnv.supabaseSecretKey), text: 'المفتاح السري لـ Supabase (للرفع والنماذج والدعوات)' },
    { done: Boolean(serverEnv.appSecret), text: 'APP_SECRET لتوقيع النماذج' },
    { done: isEmailConfigured(), text: 'إرسال البريد عبر Resend (تأكيد النشرة والتنبيهات)' },
  ];

  return (
    <>
      <AdminHeader title={`أهلًا ${staff.fullName || ''}`.trim()} description="ملخص ما يحتاج انتباهك اليوم." />
      {denied && (
        <div className="mb-8">
          <Notice tone="warn">ليست لديك صلاحية لفتح تلك الصفحة.</Notice>
        </div>
      )}
      {!configured && (
        <div className="mb-8">
          <NotConfigured />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {can(staff, 'content.edit_any') && <Tile href="/admin/episodes?status=draft" label="حلقات مسودة" value={drafts} />}
        {can(staff, 'content.edit_any') && <Tile href="/admin/episodes?status=scheduled" label="حلقات مجدولة" value={scheduled} />}
        {can(staff, 'content.publish') && <Tile href="/admin/articles?status=review" label="مقالات بانتظار المراجعة" value={review} />}
        {can(staff, 'inbox.manage') && <Tile href="/admin/messages?status=new" label="رسائل جديدة" value={newMessages} />}
        {can(staff, 'inbox.manage') && <Tile href="/admin/sponsorships?status=new" label="طلبات رعاية جديدة" value={newSponsors} />}
        {can(staff, 'subscribers.manage') && <Tile href="/admin/subscribers?status=active" label="مشتركون مفعّلون" value={subscribers} />}
      </div>

      {stats && (
        <section className="mt-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">آخر 7 أيام</h2>
            <Link href="/admin/analytics" className="text-sm text-muted underline">
              كل الإحصائيات
            </Link>
          </div>
          <p className="text-muted">
            {fmt.format(stats.totals.page_views)} مشاهدة صفحة · {fmt.format(stats.totals.plays)} تشغيل · {fmt.format(stats.totals.listeners)} مستمع
          </p>
        </section>
      )}

      {can(staff, 'settings.manage') && (
        <section className="mt-12 max-w-2xl">
          <h2 className="mb-4 text-lg font-bold">جاهزية التشغيل</h2>
          <ul className="divide-y divide-line border-y border-line">
            {setup.map((item) => (
              <li key={item.text} className="flex items-center justify-between gap-4 py-3">
                <span>{item.text}</span>
                <span className={item.done ? 'text-sm' : 'text-sm text-accent'}>{item.done ? 'مفعّل' : 'غير مفعّل'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {audit.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">آخر العمليات</h2>
            <Link href="/admin/audit" className="text-sm text-muted underline">
              السجل كاملًا
            </Link>
          </div>
          <ul className="divide-y divide-line border-y border-line text-sm">
            {audit.map((a) => (
              <li key={String(a.id)} className="flex flex-wrap justify-between gap-2 py-3">
                <span>
                  {String(a.actor_email ?? 'النظام')} · {String(a.action)} · {String(a.entity_type)} {a.summary ? `«${a.summary}»` : ''}
                </span>
                <span className="text-muted">{formatAdminDate(a.created_at as string)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
