import { AdminHeader, Filters, formatAdminDate, Row, RowList } from '@/components/admin/ui';
import { requireStaff } from '@/lib/admin/auth';
import { labelOf, MESSAGE_KINDS, MESSAGE_STATUS } from '@/lib/admin/labels';
import { listTable } from '@/lib/admin/queries';

export const metadata = { title: 'رسائل التواصل' };

export default async function MessagesAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff('inbox.manage');
  const { status } = await searchParams;
  const valid = MESSAGE_STATUS.some((s) => s.value === status) ? status : undefined;
  const rows = await listTable('contact_messages', 'id, kind, name, email, subject, status, created_at', { status: valid, order: 'created_at' });
  return (
    <>
      <AdminHeader title="رسائل التواصل" description="رسائل نموذج التواصل وطلبات الانضمام للفريق." />
      <Filters base="/admin/messages" current={valid} options={MESSAGE_STATUS} />
      <RowList empty="لا توجد رسائل.">
        {rows.map((r) => (
          <Row
            key={String(r.id)}
            href={`/admin/messages/${r.id}`}
            title={`${r.name} — ${r.subject ?? MESSAGE_KINDS[String(r.kind)]}`}
            meta={`${MESSAGE_KINDS[String(r.kind)]} · ${formatAdminDate(r.created_at as string)}`}
            aside={<span className="rounded-full border border-line px-2.5 py-0.5 text-xs">{labelOf(MESSAGE_STATUS, r.status)}</span>}
          />
        ))}
      </RowList>
    </>
  );
}
