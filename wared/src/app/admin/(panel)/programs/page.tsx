import Link from 'next/link';
import { AdminHeader, formatAdminDate, Row, RowList, StatusBadge } from '@/components/admin/ui';
import { requireStaff } from '@/lib/admin/auth';
import type { STATUS_LABELS } from '@/lib/admin/permissions';
import { listTable } from '@/lib/admin/queries';

export const metadata = { title: 'البرامج' };

export default async function ProgramsAdmin() {
  await requireStaff('content.edit_any');
  const rows = await listTable('podcasts', 'id, title, kind, status, published_at, updated_at', { order: 'sort_order' });
  return (
    <>
      <AdminHeader
        title="البرامج"
        description="كل برنامج له صفحته وخلاصة RSS خاصة به ترسلها لمنصات الاستماع."
        actions={
          <Link href="/admin/programs/new" className="btn btn-primary">
            برنامج جديد
          </Link>
        }
      />
      <RowList empty="لا توجد برامج بعد. ابدأ بإنشاء أول برنامج.">
        {rows.map((r) => (
          <Row
            key={String(r.id)}
            href={`/admin/programs/${r.id}`}
            title={String(r.title)}
            meta={formatAdminDate(r.updated_at as string)}
            aside={<StatusBadge status={r.status as keyof typeof STATUS_LABELS} publishedAt={r.published_at as string | null} />}
          />
        ))}
      </RowList>
    </>
  );
}
