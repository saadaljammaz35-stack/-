import Link from 'next/link';
import { AdminHeader, Row, RowList, StatusBadge } from '@/components/admin/ui';
import { requireStaff } from '@/lib/admin/auth';
import type { STATUS_LABELS } from '@/lib/admin/permissions';
import { listTable } from '@/lib/admin/queries';

export const metadata = { title: 'الضيوف' };

export default async function GuestsAdmin() {
  await requireStaff('content.edit_any');
  const rows = await listTable('guests', 'id, name, headline, status, published_at', { order: 'name' });
  return (
    <>
      <AdminHeader
        title="الضيوف"
        actions={
          <Link href="/admin/guests/new" className="btn btn-primary">
            ضيف جديد
          </Link>
        }
      />
      <RowList empty="لا يوجد ضيوف بعد.">
        {rows.map((r) => (
          <Row
            key={String(r.id)}
            href={`/admin/guests/${r.id}`}
            title={String(r.name)}
            meta={(r.headline as string) ?? ''}
            aside={<StatusBadge status={r.status as keyof typeof STATUS_LABELS} publishedAt={r.published_at as string | null} />}
          />
        ))}
      </RowList>
    </>
  );
}
