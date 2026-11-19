import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FileText, Printer } from 'lucide-react';
import { adminDb } from '@/lib/supabase/admin';
import { requireStaffPage } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { formatMoney } from '@/lib/money';
import { maskPhone } from '@/lib/phone';
import { fmtDateTime } from '@/lib/time';
import { Badge, PageHeader, Panel } from '@/components/admin/ui';
import { OrderActions } from '@/components/admin/OrderActions';
import { LiveRefresh } from '@/components/admin/LiveRefresh';

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaffPage('orders.view', `/admin/orders/${id}`);
  const locale = await getLocale();
  const a = adminDicts[locale];
  const db = await userDb();
  const [{ data: o }, { data: events }, { data: payments }, { data: notifs }] = await Promise.all([
    db.from('orders').select(`*, invoices(invoice_number, issued_at, status),
      order_items(id, product_name_ar, product_name_en, quantity, unit_price, line_total, bread_name_ar, bread_name_en, notes, sort_order,
        order_customizations(kind, action, quantity, name_ar, name_en, total_price, sort_order))`).eq('id', id).maybeSingle(),
    db.from('order_events').select('id, from_status, to_status, actor_type, note, created_at').eq('order_id', id).order('created_at'),
    db.from('payments').select('id, provider, provider_payment_id, status, amount, method, card_scheme, card_last4, captured_amount, refunded_amount, failure_message, created_at, receipt_path, receipt_mime, reviewed_at, review_note').eq('order_id', id).order('created_at'),
    db.from('notifications').select('id, channel, template, status, last_error, created_at').eq('order_id', id).order('created_at'),
  ]);
  if (!o) notFound();
  const pii = staff.permissions.has('orders.view_pii');
  const inv = Array.isArray(o.invoices) ? o.invoices[0] : o.invoices;
  const n = (r: { name_ar: string; name_en: string }) => (locale === 'ar' ? r.name_ar : r.name_en);
  const canPrint = staff.permissions.has('invoices.print');
  const transfer = [...(payments ?? [])].reverse().find((p) => p.provider === 'bank_transfer' && p.receipt_path);
  // receipts are private: a short-lived signed link, generated only for staff who can view orders
  const receiptUrl = transfer?.receipt_path
    ? (await adminDb().storage.from('receipts').createSignedUrl(transfer.receipt_path, 600)).data?.signedUrl ?? null : null;

  return (
    <div className="space-y-5">
      <LiveRefresh everyMs={15000} />
      <PageHeader title={`#${o.order_number} · ${o.customer_name}`} subtitle={fmtDateTime(o.created_at, locale)}
        actions={<>
          <Badge value={o.status} label={a.status[o.status as keyof typeof a.status]} />
          <Badge value={o.payment_status} label={a.payment[o.payment_status as keyof typeof a.payment]} />
        </>} />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Panel title={a.orders.items}>
            <ul className="divide-y hairline">
              {o.order_items.sort((x: { sort_order: number }, y: { sort_order: number }) => x.sort_order - y.sort_order).map((i: {
                id: string; product_name_ar: string; product_name_en: string; quantity: number; line_total: number; bread_name_ar: string | null; bread_name_en: string | null; notes: string | null;
                order_customizations: { kind: string; action: string; quantity: number; name_ar: string; name_en: string; total_price: number; sort_order: number }[] }) => (
                <li key={i.id} className="py-3">
                  <div className="flex justify-between gap-3"><p className="font-bold">{i.quantity}× {locale === 'ar' ? i.product_name_ar : i.product_name_en}</p><p className="num">{formatMoney(i.line_total, locale)}</p></div>
                  {(i.bread_name_ar) && <p className="text-sm"><strong>{a.orders.bread}:</strong> {locale === 'ar' ? i.bread_name_ar : i.bread_name_en}</p>}
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {i.order_customizations.sort((x, y) => x.sort_order - y.sort_order).filter((c) => c.kind !== 'bread').map((c, k) => (
                      <span key={k} className={`chip ${c.action === 'removed' ? 'bg-danger-500/10 text-danger-500' : c.action === 'included' ? 'bg-sand-300/60 text-espresso-600' : 'bg-ok-500/10 text-ok-500'}`}>
                        {c.action === 'removed' ? `${a.orders.without} ` : c.action === 'extra' ? `${a.orders.extra} ` : c.action === 'added' ? '+ ' : ''}{n(c)}{c.quantity > 1 ? ` ×${c.quantity}` : ''}
                        {c.total_price > 0 && <span className="num opacity-70"> ({formatMoney(c.total_price, locale)})</span>}
                      </span>
                    ))}
                  </div>
                  {i.notes && <p className="mt-1 rounded-xl bg-warn-500/10 px-2 py-1 text-sm">📝 {i.notes}</p>}
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t hairline pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd className="num">{formatMoney(o.subtotal, locale)}</dd></div>
              {o.discount_total > 0 && <div className="flex justify-between text-ok-500"><dt>{o.coupon_code ?? ''} {o.points_redeemed ? `· ${o.points_redeemed} pts` : ''}</dt><dd className="num">− {formatMoney(o.discount_total, locale)}</dd></div>}
              <div className="flex justify-between text-espresso-500"><dt>VAT</dt><dd className="num">{formatMoney(o.vat_amount, locale)}</dd></div>
              <div className="flex justify-between text-lg font-bold"><dt>{a.orders.total}</dt><dd className="num">{formatMoney(o.total, locale)}</dd></div>
            </dl>
            {o.notes && <p className="mt-3 rounded-2xl bg-warn-500/10 p-3 text-sm"><strong>{a.orders.notes}:</strong> {o.notes}</p>}
          </Panel>
          <Panel title={a.orders.timeline}>
            <ol className="space-y-2 text-sm">
              {(events ?? []).map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2">
                  <span className="num text-xs text-espresso-500" dir="ltr">{fmtDateTime(e.created_at, locale)}</span>
                  <Badge value={e.to_status} label={a.status[e.to_status as keyof typeof a.status]} />
                  <span className="text-xs text-espresso-500">{e.actor_type}</span>
                  {e.note && <span className="text-xs">— {e.note}</span>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel><OrderActions id={o.id} status={o.status} paymentStatus={o.payment_status} perms={[...staff.permissions]} isTransfer={Boolean(transfer)} /></Panel>
          {receiptUrl && (
            <Panel title={`${a.orders.receipt} · ${a.orders.bankTransfer}`}>
              {transfer?.receipt_mime === 'application/pdf' || transfer?.receipt_mime === 'image/heic' ? (
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-full"><FileText className="size-4" /> {a.orders.openReceipt}</a>
              ) : (
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer" data-testid="receipt-link">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={receiptUrl} alt={a.orders.receipt} className="max-h-96 w-full rounded-2xl object-contain shadow-soft" />
                </a>
              )}
              <p className="num mt-2 text-sm font-semibold">{formatMoney(o.total, locale)}</p>
            </Panel>
          )}
          <Panel title={a.orders.customer}>
            <dl className="space-y-1.5 text-sm">
              <div><dt className="text-espresso-500">{a.orders.customer}</dt><dd className="font-semibold">{o.customer_name}</dd></div>
              <div><dt className="text-espresso-500">{a.orders.phone}</dt><dd className="num" dir="ltr">{pii ? o.customer_phone : maskPhone(o.customer_phone)}</dd></div>
              {o.customer_email && pii && <div><dt className="text-espresso-500">{a.orders.email}</dt><dd dir="ltr">{o.customer_email}</dd></div>}
              <div><dt className="text-espresso-500">{a.orders.pickupCode}</dt><dd className="num text-lg font-bold tracking-widest">{o.pickup_code}</dd></div>
              {inv && <div><dt className="text-espresso-500">{a.orders.invoice}</dt><dd className="num">{inv.invoice_number}</dd></div>}
              {o.reject_reason && <div><dt className="text-espresso-500">Reason</dt><dd>{o.reject_reason}</dd></div>}
            </dl>
          </Panel>
          {canPrint && (
            <Panel title={a.common.print}>
              <div className="flex flex-wrap gap-2">
                {inv && ['80mm', '58mm', 'a4'].map((f) => <Link key={f} href={`/admin/print/${o.id}?format=${f}`} target="_blank" className="btn btn-sm btn-ghost"><Printer className="size-4" /> {a.orders.print} {f}</Link>)}
                <Link href={`/admin/print/${o.id}?format=80mm&kind=kitchen`} target="_blank" className="btn btn-sm btn-ghost"><Printer className="size-4" /> {a.orders.printKitchen}</Link>
              </div>
            </Panel>
          )}
          <Panel title={a.orders.payment}>
            <ul className="space-y-2 text-sm">
              {(payments ?? []).map((p) => (
                <li key={p.id} className="rounded-2xl bg-cream-100/70 p-2.5">
                  <div className="flex justify-between"><Badge value={p.status} label={a.payment[p.status as keyof typeof a.payment]} /><span className="num">{formatMoney(p.amount, locale)}</span></div>
                  <p className="num mt-1 text-xs text-espresso-500" dir="ltr">{p.provider} · {p.method ?? ''} {p.card_scheme ?? ''} {p.card_last4 ? `•••• ${p.card_last4}` : ''}</p>
                  {p.refunded_amount > 0 && <p className="num text-xs">refunded {formatMoney(p.refunded_amount, locale)}</p>}
                  {p.failure_message && <p className="text-xs text-danger-500">{p.failure_message}</p>}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={a.nav.notifications}>
            <ul className="space-y-1 text-xs">
              {(notifs ?? []).map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-2"><span>{x.template} · {x.channel}</span><Badge value={x.status} label={a.notif.st[x.status as keyof typeof a.notif.st]} /></li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
