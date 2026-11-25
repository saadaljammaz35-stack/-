import { notFound } from 'next/navigation';
import { ActionButton } from '@/components/admin/ActionButton';
import { InboxEditor } from '@/components/admin/InboxEditor';
import { AdminHeader, formatAdminDate } from '@/components/admin/ui';
import { deleteInboxItem } from '@/lib/admin/actions/manage';
import { requireStaff } from '@/lib/admin/auth';
import { BUDGETS, INTERESTS, SPONSORSHIP_STATUS } from '@/lib/admin/labels';
import { getRow } from '@/lib/admin/queries';

export const metadata = { title: 'طلب رعاية' };

export default async function SponsorshipDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff('inbox.manage');
  const { id } = await params;
  const row = await getRow('sponsorship_requests', id);
  if (!row) notFound();
  const fields: [string, unknown][] = [
    ['المسؤول', row.contact_name],
    ['البريد', row.email],
    ['الجوال', row.phone],
    ['الموقع', row.website],
    ['الميزانية', BUDGETS[String(row.budget_range)]],
    ['الاهتمامات', ((row.interests as string[]) ?? []).map((i) => INTERESTS[i] ?? i).join('، ')],
    ['التاريخ', formatAdminDate(row.created_at as string)],
  ];
  return (
    <>
      <AdminHeader
        title={String(row.company)}
        back={{ href: '/admin/sponsorships', label: 'طلبات الرعاية' }}
        actions={
          <>
            <a href={`mailto:${row.email}`} className="btn btn-primary min-h-10 px-4 text-sm">
              رد بالبريد
            </a>
            <ActionButton action={deleteInboxItem.bind(null, 'sponsorship_requests', id)} label="حذف" tone="danger" confirm="حذف الطلب نهائيًا؟" />
          </>
        }
      />
      <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <dl className="mb-8 grid gap-x-6 gap-y-3 sm:grid-cols-[8rem_1fr]">
            {fields
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-sm text-muted">{k}</dt>
                  <dd className="break-words" dir="auto">
                    {String(v)}
                  </dd>
                </div>
              ))}
          </dl>
          <p className="whitespace-pre-wrap rounded-2xl border border-line p-6 leading-8" dir="auto">
            {String(row.message)}
          </p>
        </div>
        <InboxEditor table="sponsorship_requests" id={id} status={String(row.status)} notes={String(row.internal_notes ?? '')} statuses={SPONSORSHIP_STATUS} />
      </div>
    </>
  );
}
