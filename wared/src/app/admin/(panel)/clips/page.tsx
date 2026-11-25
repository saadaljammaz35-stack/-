import Link from 'next/link';
import { AdminHeader, formatAdminDate, Row, RowList, StatusBadge } from '@/components/admin/ui';
import { requireStaff } from '@/lib/admin/auth';
import type { STATUS_LABELS } from '@/lib/admin/permissions';
import { listTable } from '@/lib/admin/queries';

export const metadata = { title: 'المقاطع القصيرة' };

export default async function ClipsAdmin() {
  await requireStaff('content.edit_any');
  const rows = await listTable('clips', 'id, title, orientation, status, published_at, updated_at');
  return (
    <>
      <AdminHeader
        title="المقاطع القصيرة"
        actions={
          <Link href="/admin/clips/new" className="btn btn-primary">
            مقطع جديد
          </Link>
        }
      />
      <RowList empty="لا توجد مقاطع بعد.">
        {rows.map((r) => (
          <Row
            key={String(r.id)}
            href={`/admin/clips/${r.id}`}
            title={String(r.title)}
            meta={`${r.orientation === 'vertical' ? 'عمودي' : 'أفقي'} · ${formatAdminDate(r.updated_at as string)}`}
            aside={<StatusBadge status={r.status as keyof typeof STATUS_LABELS} publishedAt={r.published_at as string | null} />}
          />
        ))}
      </RowList>
    </>
  );
}
