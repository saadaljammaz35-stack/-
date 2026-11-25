import Link from 'next/link';
import { AdminHeader, Filters, formatAdminDate, Row, RowList, StatusBadge } from '@/components/admin/ui';
import { can, requireStaff } from '@/lib/admin/auth';
import { STATUS_LABELS } from '@/lib/admin/permissions';
import { listTable } from '@/lib/admin/queries';

export const metadata = { title: 'القصص والمقالات' };

export default async function ArticlesAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const staff = await requireStaff('content.create');
  const { status } = await searchParams;
  const valid = status && status in STATUS_LABELS ? status : undefined;
  const rows = await listTable('articles', 'id, title, kind, status, published_at, updated_at, author_name, created_by', { status: valid });
  const mineOnly = !can(staff, 'content.edit_any');
  const visible = mineOnly ? rows.filter((r) => r.created_by === staff.id) : rows;
  return (
    <>
      <AdminHeader
        title="القصص والمقالات"
        description={mineOnly ? 'بصفتك كاتبًا: تكتب مسوداتك وترسلها للمراجعة، والمحرر ينشرها.' : 'اكتب وراجع وانشر وجدول القصص والمقالات.'}
        actions={
          <Link href="/admin/articles/new" className="btn btn-primary">
            مقال جديد
          </Link>
        }
      />
      <Filters base="/admin/articles" current={valid} options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
      <RowList empty="لا توجد مقالات بعد.">
        {visible.map((r) => (
          <Row
            key={String(r.id)}
            href={`/admin/articles/${r.id}`}
            title={String(r.title)}
            meta={`${r.author_name ?? ''} · ${formatAdminDate((r.published_at as string) ?? (r.updated_at as string))}`}
            aside={<StatusBadge status={r.status as keyof typeof STATUS_LABELS} publishedAt={r.published_at as string | null} />}
          />
        ))}
      </RowList>
    </>
  );
}
