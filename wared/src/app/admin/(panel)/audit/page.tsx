import Link from 'next/link';
import { AdminHeader, formatAdminDate } from '@/components/admin/ui';
import { requireStaff } from '@/lib/admin/auth';
import { getSessionClient } from '@/lib/supabase/server';

export const metadata = { title: 'سجل العمليات' };

const ACTIONS: Record<string, string> = { insert: 'إضافة', update: 'تعديل', delete: 'حذف' };
const ENTITIES: Record<string, string> = {
  podcasts: 'برنامج',
  episodes: 'حلقة',
  episode_chapters: 'فصل',
  transcripts: 'نص مفرغ',
  guests: 'ضيف',
  episode_guests: 'ضيف حلقة',
  categories: 'تصنيف',
  articles: 'مقال',
  clips: 'مقطع',
  media_assets: 'ملف',
  profiles: 'مستخدم',
  site_settings: 'إعدادات',
  sponsorship_requests: 'طلب رعاية',
  contact_messages: 'رسالة',
  subscribers: 'مشترك',
};
const PAGE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; entity?: string }> }) {
  await requireStaff('audit.read');
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);
  const entity = sp.entity && sp.entity in ENTITIES ? sp.entity : undefined;
  const db = await getSessionClient();
  let rows: Record<string, unknown>[] = [];
  let total = 0;
  if (db) {
    let query = db.from('audit_logs').select('id, actor_email, action, entity_type, entity_id, summary, changes, created_at', { count: 'exact' }).order('created_at', { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
    if (entity) query = query.eq('entity_type', entity);
    const { data, count } = await query;
    rows = data ?? [];
    total = count ?? 0;
  }
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (p: number) => `/admin/audit?page=${p}${entity ? `&entity=${entity}` : ''}`;
  return (
    <>
      <AdminHeader title="سجل العمليات" description="يُسجَّل كل تغيير على المحتوى والمستخدمين والإعدادات تلقائيًا من قاعدة البيانات، ولا يمكن تعديله أو حذفه من اللوحة." />
      <nav aria-label="تصفية" className="mb-6 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/audit" className={`rounded-full border px-3 py-1.5 ${!entity ? 'border-fg bg-fg text-bg' : 'border-line'}`}>
          الكل
        </Link>
        {Object.entries(ENTITIES).map(([key, label]) => (
          <Link key={key} href={`/admin/audit?entity=${key}`} className={`rounded-full border px-3 py-1.5 ${entity === key ? 'border-fg bg-fg text-bg' : 'border-line'}`}>
            {label}
          </Link>
        ))}
      </nav>
      <ul className="divide-y divide-line border-y border-line text-sm">
        {rows.length === 0 && <li className="py-8 text-muted">لا توجد عمليات مسجلة.</li>}
        {rows.map((r) => (
          <li key={String(r.id)} className="py-4">
            <div className="flex flex-wrap justify-between gap-2">
              <span>
                <strong>{ACTIONS[String(r.action)] ?? String(r.action)}</strong> {ENTITIES[String(r.entity_type)] ?? String(r.entity_type)}
                {r.summary ? ` «${r.summary}»` : ''} — <span dir="ltr">{String(r.actor_email ?? 'system')}</span>
              </span>
              <span className="text-muted">{formatAdminDate(r.created_at as string)}</span>
            </div>
            {r.changes ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-muted">التغييرات ({Object.keys(r.changes as object).length})</summary>
                <ul className="mt-2 space-y-1 font-mono text-xs" dir="ltr">
                  {Object.entries(r.changes as Record<string, { from: string; to: string }>).map(([k, v]) => (
                    <li key={k} className="break-all">
                      {k}: {v.from} → {v.to}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm" aria-label="الصفحات">
          {page > 1 ? <Link href={href(page - 1)} className="btn btn-ghost min-h-10 px-4">السابق</Link> : <span />}
          <span className="text-muted">
            صفحة {page} من {pages}
          </span>
          {page < pages ? <Link href={href(page + 1)} className="btn btn-ghost min-h-10 px-4">التالي</Link> : <span />}
        </nav>
      )}
    </>
  );
}
