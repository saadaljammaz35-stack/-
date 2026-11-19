import Link from 'next/link';
import { requireStaffPage } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { fmtDateTime } from '@/lib/time';
import { Badge, PageHeader } from '@/components/admin/ui';
import { maskPhone } from '@/lib/phone';

export default async function NotificationsPage() {
  const staff = await requireStaffPage('notifications.view', '/admin/notifications');
  const locale = await getLocale();
  const a = adminDicts[locale];
  const { data } = await (await userDb()).from('notifications').select('id, order_id, audience, channel, template, recipient, status, attempts, last_error, created_at').order('created_at', { ascending: false }).limit(200);
  const pii = staff.permissions.has('orders.view_pii');
  return (
    <div>
      <PageHeader title={a.notif.title} />
      <div className="glass overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b hairline text-xs text-espresso-500">{[a.audit.when, a.notif.template, a.notif.channel, a.notif.recipient, a.notif.status, a.notif.error].map((h, i) => <th key={i} className="px-3 py-3 text-start">{h}</th>)}</tr></thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id} className="border-b hairline">
                <td className="num px-3 py-2 text-xs" dir="ltr">{fmtDateTime(r.created_at, locale)}</td>
                <td className="px-3 py-2">{r.order_id ? <Link className="underline" href={`/admin/orders/${r.order_id}`}>{r.template}</Link> : r.template}</td>
                <td className="px-3 py-2">{r.channel}</td>
                <td className="px-3 py-2 text-xs" dir="ltr">{pii || r.audience === 'staff' ? r.recipient : r.channel === 'email' ? r.recipient.replace(/^(.).*(@.*)$/, '$1•••$2') : maskPhone(r.recipient)}</td>
                <td className="px-3 py-2"><Badge value={r.status} label={a.notif.st[r.status as keyof typeof a.notif.st]} /></td>
                <td className="px-3 py-2 text-xs text-danger-500">{r.last_error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
