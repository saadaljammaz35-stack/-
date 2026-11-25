import Link from 'next/link';
import { AdminHeader, Filters, formatAdminDate, NotConfigured, Row, RowList, StatusBadge } from '@/components/admin/ui';
import { requireStaff } from '@/lib/admin/auth';
import { STATUS_LABELS } from '@/lib/admin/permissions';
import { listTable } from '@/lib/admin/queries';
import { isSupabaseConfigured } from '@/lib/env';

export const metadata = { title: 'الحلقات' };

export default async function EpisodesAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff('content.edit_any');
  const { status } = await searchParams;
  const valid = status && status in STATUS_LABELS ? status : undefined;
  const rows = await listTable('episodes', 'id, title, number, status, published_at, updated_at, podcast:podcasts(title)', { status: valid });
  return (
    <>
      <AdminHeader
        title="الحلقات"
        description="أنشئ الحلقات وارفع الصوت وأضف الفصول والنص المفرغ وجدول النشر."
        actions={
          <Link href="/admin/episodes/new" className="btn btn-primary">
            حلقة جديدة
          </Link>
        }
      />
      {!isSupabaseConfigured() && <NotConfigured />}
      <Filters base="/admin/episodes" current={valid} options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
      <RowList empty="لا توجد حلقات بعد.">
        {rows.map((r) => (
          <Row
            key={String(r.id)}
            href={`/admin/episodes/${r.id}`}
            title={`${r.number ? `${r.number}. ` : ''}${r.title}`}
            meta={`${(r.podcast as { title?: string } | null)?.title ?? ''} · ${formatAdminDate((r.published_at as string) ?? (r.updated_at as string))}`}
            aside={<StatusBadge status={r.status as keyof typeof STATUS_LABELS} publishedAt={r.published_at as string | null} />}
          />
        ))}
      </RowList>
    </>
  );
}
