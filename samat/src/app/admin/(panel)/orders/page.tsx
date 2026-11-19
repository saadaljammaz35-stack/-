import Link from 'next/link';
import { requireStaffPage } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { formatMoney } from '@/lib/money';
import { normalizeSaudiPhone, maskPhone } from '@/lib/phone';
import { fmtDateTime } from '@/lib/time';
import { Badge, PageHeader } from '@/components/admin/ui';
import { OrderActions } from '@/components/admin/OrderActions';
import { OrderAlert } from '@/components/admin/OrderAlert';

const FILTERS = ['active', 'awaiting_approval', 'accepted', 'preparing', 'ready', 'delivered', 'rejected', 'cancelled', 'pending_payment', 'all'] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const staff = await requireStaffPage('orders.view', '/admin/orders');
  const locale = await getLocale();
  const a = adminDicts[locale];
  const { status = 'active', q = '' } = await searchParams;
  const pii = staff.permissions.has('orders.view_pii');
  const db = await userDb();
  let query = db.from('orders')
    .select('id, order_number, business_day, status, payment_status, customer_name, customer_phone, total, created_at, pickup_code, order_items(quantity, product_name_ar, product_name_en)')
    .order('created_at', { ascending: false }).limit(100);
  if (status === 'active') query = query.in('status', ['awaiting_approval', 'accepted', 'preparing', 'ready']);
  else if (status !== 'all' && (FILTERS as readonly string[]).includes(status)) query = query.eq('status', status);
  const term = q.trim();
  if (term) {
    const phone = normalizeSaudiPhone(term);
    if (/^\d{1,6}$/.test(term)) query = query.eq('order_number', Number(term));
    else if (phone && pii) query = query.eq('customer_phone', phone);
    else if (/^[A-Za-z0-9]{6}$/.test(term)) query = query.eq('pickup_code', term.toUpperCase());
    else query = query.ilike('customer_name', `%${term.replace(/[%_,()]/g, '')}%`);
  }
  const { data: orders } = await query;
  const perms = [...staff.permissions];

  return (
    <div>
      <PageHeader title={a.orders.title} actions={<OrderAlert watch="awaiting_approval" label={a.orders.newOrderAlert} onLabel={a.orders.soundOn} offLabel={a.orders.soundOff} storageKey="samat_admin_sound" />} />
      <form className="mb-4 flex flex-wrap gap-2" action="/admin/orders">
        <input name="q" defaultValue={q} className="field max-w-md flex-1" placeholder={a.orders.search} data-testid="orders-search" />
        <input type="hidden" name="status" value={status} />
        <button className="btn btn-primary">{a.common.search}</button>
      </form>
      <div className="scrollbar-none mb-5 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link key={f} href={`/admin/orders?status=${f}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`chip whitespace-nowrap px-4 py-2 ${status === f ? 'bg-espresso-800 text-cream-100' : 'glass'}`}>
            {f === 'active' ? a.orders.active : f === 'all' ? a.orders.all : a.status[f]}
          </Link>
        ))}
      </div>
      {!orders?.length ? <p className="paper rounded-3xl p-8 text-center text-espresso-500">{a.orders.empty}</p> : (
        <ul className="grid gap-3 xl:grid-cols-2" data-testid="orders-list">
          {orders.map((o) => (
            <li key={o.id} className={`glass rounded-3xl p-4 ${o.status === 'awaiting_approval' ? 'ring-2 ring-warn-500' : ''}`} data-testid={`order-${o.order_number}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link href={`/admin/orders/${o.id}`} className="group">
                  <p className="text-lg font-bold"><span className="num">#{o.order_number}</span> · {o.customer_name}</p>
                  <p className="num text-xs text-espresso-500" dir="ltr">{fmtDateTime(o.created_at, locale)} · {pii ? o.customer_phone : maskPhone(o.customer_phone)}</p>
                </Link>
                <div className="flex flex-col items-end gap-1">
                  <Badge value={o.status} label={a.status[o.status as keyof typeof a.status]} />
                  <Badge value={o.payment_status} label={a.payment[o.payment_status as keyof typeof a.payment]} />
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-espresso-600">
                {o.order_items.map((i) => `${i.quantity}× ${locale === 'ar' ? i.product_name_ar : i.product_name_en}`).join('، ')}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="num font-bold">{formatMoney(o.total, locale)}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <OrderActions id={o.id} status={o.status} paymentStatus={o.payment_status} perms={perms} compact />
                  <Link href={`/admin/orders/${o.id}`} className="btn btn-sm btn-ghost">{a.orders.detail}</Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
