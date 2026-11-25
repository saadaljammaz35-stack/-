import { AdminHeader, Filters, formatAdminDate, Row, RowList } from '@/components/admin/ui';
import { requireStaff } from '@/lib/admin/auth';
import { BUDGETS, labelOf, SPONSORSHIP_STATUS } from '@/lib/admin/labels';
import { listTable } from '@/lib/admin/queries';

export const metadata = { title: 'طلبات الرعاية' };

export default async function SponsorshipsAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff('inbox.manage');
  const { status } = await searchParams;
  const valid = SPONSORSHIP_STATUS.some((s) => s.value === status) ? status : undefined;
  const rows = await listTable('sponsorship_requests', 'id, company, contact_name, budget_range, status, created_at', { status: valid, order: 'created_at' });
  return (
    <>
      <AdminHeader title="طلبات الرعاية" />
      <Filters base="/admin/sponsorships" current={valid} options={SPONSORSHIP_STATUS} />
      <RowList empty="لا توجد طلبات رعاية.">
        {rows.map((r) => (
          <Row
            key={String(r.id)}
            href={`/admin/sponsorships/${r.id}`}
            title={String(r.company)}
            meta={`${r.contact_name} · ${BUDGETS[String(r.budget_range)] ?? 'بدون ميزانية'} · ${formatAdminDate(r.created_at as string)}`}
            aside={<span className="rounded-full border border-line px-2.5 py-0.5 text-xs">{labelOf(SPONSORSHIP_STATUS, r.status)}</span>}
          />
        ))}
      </RowList>
    </>
  );
}
