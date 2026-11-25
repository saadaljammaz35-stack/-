import { notFound } from 'next/navigation';
import { ActionButton } from '@/components/admin/ActionButton';
import { InboxEditor } from '@/components/admin/InboxEditor';
import { AdminHeader, formatAdminDate } from '@/components/admin/ui';
import { deleteInboxItem } from '@/lib/admin/actions/manage';
import { requireStaff } from '@/lib/admin/auth';
import { MESSAGE_KINDS, MESSAGE_STATUS } from '@/lib/admin/labels';
import { getRow } from '@/lib/admin/queries';

export const metadata = { title: 'رسالة' };

export default async function MessageDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff('inbox.manage');
  const { id } = await params;
  const row = await getRow('contact_messages', id);
  if (!row) notFound();
  const fields: [string, unknown][] = [
    ['النوع', MESSAGE_KINDS[String(row.kind)]],
    ['البريد', row.email],
    ['الدور', row.position],
    ['رابط الأعمال', row.portfolio_url],
    ['اللغة', row.locale === 'ar' ? 'العربية' : 'الإنجليزية'],
    ['التاريخ', formatAdminDate(row.created_at as string)],
  ];
  return (
    <>
      <AdminHeader
        title={String(row.name)}
        description={(row.subject as string) ?? undefined}
        back={{ href: '/admin/messages', label: 'الرسائل' }}
        actions={
          <>
            <a href={`mailto:${row.email}`} className="btn btn-primary min-h-10 px-4 text-sm">
              رد بالبريد
            </a>
            <ActionButton action={deleteInboxItem.bind(null, 'contact_messages', id)} label="حذف" tone="danger" confirm="حذف الرسالة نهائيًا؟" />
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
        <InboxEditor table="contact_messages" id={id} status={String(row.status)} notes={String(row.internal_notes ?? '')} statuses={MESSAGE_STATUS} />
      </div>
    </>
  );
}
