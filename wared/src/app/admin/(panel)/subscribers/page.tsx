import { ActionButton } from '@/components/admin/ActionButton';
import { AdminHeader, Filters, formatAdminDate, Row, RowList } from '@/components/admin/ui';
import { deleteSubscriber, setSubscriberStatus } from '@/lib/admin/actions/manage';
import { requireStaff } from '@/lib/admin/auth';
import { count, listTable } from '@/lib/admin/queries';
import { isEmailConfigured } from '@/lib/server-env';

export const metadata = { title: 'مشتركو النشرة' };

const STATUS = [
  { value: 'active', label: 'مفعّل' },
  { value: 'pending', label: 'بانتظار التأكيد' },
  { value: 'unsubscribed', label: 'ألغى الاشتراك' },
];

export default async function SubscribersAdmin({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff('subscribers.manage');
  const { status } = await searchParams;
  const valid = STATUS.some((s) => s.value === status) ? status : undefined;
  const [rows, active, pending] = await Promise.all([
    listTable('subscribers', 'id, email, status, locale, source, created_at, confirmed_at', { status: valid, order: 'created_at', limit: 500 }),
    count('subscribers', { status: 'active' }),
    count('subscribers', { status: 'pending' }),
  ]);
  return (
    <>
      <AdminHeader
        title="مشتركو النشرة"
        description={`${active} مفعّل · ${pending} بانتظار التأكيد`}
        actions={
          <a href={`/admin/export/subscribers${valid ? `?status=${valid}` : ''}`} className="btn btn-ghost min-h-10 px-4 text-sm">
            تصدير CSV
          </a>
        }
      />
      {!isEmailConfigured() && (
        <p className="mb-6 rounded-2xl border border-sand p-4 text-sm leading-7">
          إرسال البريد غير مفعّل بعد (RESEND_API_KEY وEMAIL_FROM)، لذلك تبقى الاشتراكات الجديدة «بانتظار التأكيد» ولا تصلها رسالة تأكيد.
        </p>
      )}
      <Filters base="/admin/subscribers" current={valid} options={STATUS} />
      <RowList empty="لا يوجد مشتركون.">
        {rows.map((r) => (
          <Row
            key={String(r.id)}
            title={<span dir="ltr">{String(r.email)}</span>}
            meta={`${STATUS.find((s) => s.value === r.status)?.label} · ${r.locale === 'ar' ? 'عربي' : 'English'} · ${formatAdminDate(r.created_at as string)}`}
            aside={
              <>
                {r.status !== 'unsubscribed' ? (
                  <ActionButton action={setSubscriberStatus.bind(null, String(r.id), 'unsubscribed')} label="إلغاء" />
                ) : (
                  <ActionButton action={setSubscriberStatus.bind(null, String(r.id), 'active')} label="إعادة تفعيل" confirm="أعد التفعيل فقط بطلب صريح من صاحب البريد. متابعة؟" />
                )}
                <ActionButton action={deleteSubscriber.bind(null, String(r.id))} label="حذف" tone="danger" confirm="حذف المشترك وبياناته نهائيًا؟" />
              </>
            }
          />
        ))}
      </RowList>
    </>
  );
}
