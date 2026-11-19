import Link from 'next/link';
import { AlertTriangle, PackageX } from 'lucide-react';
import { requireStaffPage } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { adminDb } from '@/lib/supabase/admin';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { formatMoney } from '@/lib/money';
import { daysAgo, riyadhStartOfDay } from '@/lib/time';
import { PageHeader, Panel, Stat } from '@/components/admin/ui';
import { DailySalesChart, PeakHoursChart } from '@/components/admin/Charts';
import { BusyControls } from '@/components/admin/BusyControls';
import { LiveRefresh } from '@/components/admin/LiveRefresh';
import type { StoreState } from '@/lib/catalog-types';

type Overview = { revenue: number; sales_orders: number; avg_order_value: number; awaiting_approval: number; accepted: number; preparing: number; ready: number; delivered: number; rejected: number; cancelled: number };

export default async function Dashboard() {
  const staff = await requireStaffPage('dashboard.view');
  const locale = await getLocale();
  const a = adminDicts[locale];
  const db = await userDb();
  const now = new Date();
  const to = new Date(now.getTime() + 60_000).toISOString();
  const [today, week, month, series, hours, products, state, settings, avail, inv] = await Promise.all([
    db.rpc('report_overview', { p_from: riyadhStartOfDay(now).toISOString(), p_to: to }),
    db.rpc('report_overview', { p_from: daysAgo(6).toISOString(), p_to: to }),
    db.rpc('report_overview', { p_from: daysAgo(29).toISOString(), p_to: to }),
    db.rpc('report_timeseries', { p_from: daysAgo(29).toISOString(), p_to: to, p_bucket: 'day' }),
    db.rpc('report_hours', { p_from: daysAgo(29).toISOString(), p_to: to }),
    db.rpc('report_products', { p_from: daysAgo(29).toISOString(), p_to: to }),
    adminDb().rpc('store_state'),
    adminDb().from('store_settings').select('busy_extra_minutes, max_active_orders, pause_message_ar, busy_message_ar').eq('id', 1).single(),
    adminDb().rpc('menu_availability'),
    db.rpc('inventory_status'),
  ]);
  const t = today.data as Overview; const w = week.data as Overview; const m = month.data as Overview;
  const prods = (products.data ?? []) as { product_id: string; name_ar: string; name_en: string; quantity: number; revenue: number; is_active: boolean; is_available: boolean }[];
  const active = prods.filter((p) => p.is_active);
  const top = active.filter((p) => p.quantity > 0).slice(0, 5);
  const bottom = [...active].sort((x, y) => x.quantity - y.quantity).slice(0, 5);
  const availability = (avail.data ?? { products: {} }) as { products: Record<string, boolean> };
  const unavailable = active.filter((p) => availability.products[p.product_id] === false);
  const low = ((inv.data ?? []) as { id: string; name_ar: string; name_en: string; available: number; low_threshold: number; unit: string; is_low: boolean }[]).filter((i) => i.is_low);
  const n = (r: { name_ar: string; name_en: string }) => (locale === 'ar' ? r.name_ar : r.name_en);

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <PageHeader title={a.nav.dashboard} subtitle={a.dash.actualNote}
        actions={staff.permissions.has('orders.view') ? <Link href="/admin/orders" className="btn btn-primary">{a.nav.orders} {t.awaiting_approval > 0 && <span className="chip bg-terracotta-500 text-white">{t.awaiting_approval}</span>}</Link> : null} />
      {staff.permissions.has('busy.manage') && <BusyControls state={state.data as StoreState} settings={settings.data!} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="kpis">
        <Stat tone="dark" label={`${a.dash.revenue} · ${a.dash.today}`} value={formatMoney(t.revenue, locale)} hint={`${t.sales_orders} ${a.dash.orders}`} />
        <Stat label={`${a.dash.revenue} · ${a.dash.week}`} value={formatMoney(w.revenue, locale)} hint={`${w.sales_orders} ${a.dash.orders}`} />
        <Stat label={`${a.dash.revenue} · ${a.dash.month}`} value={formatMoney(m.revenue, locale)} hint={`${m.sales_orders} ${a.dash.orders}`} />
        <Stat label={`${a.dash.avg} · ${a.dash.month}`} value={formatMoney(m.avg_order_value, locale)} />
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <Stat tone={t.awaiting_approval ? 'accent' : 'default'} label={a.dash.newOrders} value={t.awaiting_approval} />
        <Stat label={a.status.accepted} value={t.accepted} />
        <Stat label={a.dash.preparing} value={t.preparing} />
        <Stat label={a.dash.ready} value={t.ready} />
        <Stat label={a.dash.delivered} value={t.delivered} />
        <Stat label={`${a.dash.rejected}/${a.dash.cancelled}`} value={t.rejected + t.cancelled} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`${a.dash.salesTrend} · ${a.dash.month}`}><DailySalesChart data={(series.data ?? []) as { bucket: string; revenue: number; orders: number }[]} /></Panel>
        <Panel title={`${a.dash.peakHours} · ${a.dash.month}`}><PeakHoursChart data={(hours.data ?? []) as { hour: number; orders: number; revenue: number }[]} /></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`${a.dash.topProducts} · ${a.dash.month}`}>
          {top.length === 0 ? <p className="text-sm text-espresso-500">{a.dash.noData}</p> : (
            <ol className="space-y-2">{top.map((p, i) => (
              <li key={p.product_id} className="flex items-center gap-3 text-sm">
                <span className="num grid size-7 place-items-center rounded-full bg-espresso-800 text-xs text-cream-100">{i + 1}</span>
                <span className="flex-1 font-semibold">{n(p)}</span>
                <span className="num text-espresso-500">{p.quantity} {a.dash.sold}</span>
                <span className="num w-24 text-end">{formatMoney(p.revenue, locale)}</span>
              </li>))}
            </ol>)}
        </Panel>
        <Panel title={`${a.dash.lowProducts} · ${a.dash.month}`}>
          <ol className="space-y-2">{bottom.map((p) => (
            <li key={p.product_id} className="flex items-center justify-between text-sm"><span>{n(p)}</span><span className="num text-espresso-500">{p.quantity} {a.dash.sold}</span></li>))}
          </ol>
        </Panel>
        <Panel title={a.dash.unavailable}>
          {unavailable.length === 0 ? <p className="text-sm text-espresso-500">—</p> : (
            <ul className="space-y-1.5 text-sm">{unavailable.map((p) => <li key={p.product_id} className="flex items-center gap-2"><PackageX className="size-4 text-danger-500" /> {n(p)}</li>)}</ul>)}
        </Panel>
        <Panel title={a.dash.lowStock} actions={staff.permissions.has('inventory.manage') ? <Link href="/admin/inventory" className="text-sm font-semibold text-terracotta-500">{a.nav.inventory}</Link> : null}>
          {low.length === 0 ? <p className="text-sm text-espresso-500">—</p> : (
            <ul className="space-y-1.5 text-sm">{low.map((i) => (
              <li key={i.id} className="flex items-center gap-2"><AlertTriangle className="size-4 text-warn-500" /> <span className="flex-1">{n(i)}</span><span className="num">{Number(i.available)} {i.unit}</span></li>))}
            </ul>)}
        </Panel>
      </div>
    </div>
  );
}
