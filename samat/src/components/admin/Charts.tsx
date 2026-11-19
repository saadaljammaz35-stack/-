'use client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/lib/money';
import { useAdmin } from '@/lib/i18n/admin-client';

// Single-series charts: one validated hue (terracotta on cream), thin bars with a rounded data-end,
// hairline solid grid, hover tooltip, and a table view for screen readers / exact values.
const HUE = '#b8502c';
const GRID = '#e6dcc8';
const INK = '#7a6455';

export function DailySalesChart({ data }: { data: { bucket: string; revenue: number; orders: number }[] }) {
  const { a, locale } = useAdmin();
  const rows = data.map((d) => ({ ...d, label: new Date(d.bucket).toLocaleDateString(locale === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short' }) }));
  if (!rows.length) return <p className="py-10 text-center text-sm text-espresso-500">{a.dash.noData}</p>;
  return (
    <>
      <div className="h-56" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: INK, fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: INK, fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 100)}`} />
            <Tooltip cursor={{ fill: 'rgba(184,80,44,0.08)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e6dcc8', fontFamily: 'inherit' }}
              formatter={(v) => [formatMoney(Number(v), locale), a.dash.revenue]} labelFormatter={(l) => String(l)} />
            <Bar dataKey="revenue" fill={HUE} maxBarSize={24} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs text-espresso-600">
        <summary className="cursor-pointer">Table</summary>
        <table className="num mt-2 w-full"><tbody>{rows.map((r) => <tr key={r.bucket}><td>{r.label}</td><td>{r.orders}</td><td className="text-end">{formatMoney(r.revenue, locale)}</td></tr>)}</tbody></table>
      </details>
    </>
  );
}

export function PeakHoursChart({ data }: { data: { hour: number; orders: number; revenue: number }[] }) {
  const { a, locale } = useAdmin();
  const rows = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${String(h).padStart(2, '0')}`, orders: data.find((d) => d.hour === h)?.orders ?? 0 }));
  if (!data.length) return <p className="py-10 text-center text-sm text-espresso-500">{a.dash.noData}</p>;
  return (
    <>
      <div className="h-56" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: INK, fontSize: 10 }} interval={2} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tick={{ fill: INK, fontSize: 11 }} />
            <Tooltip cursor={{ fill: 'rgba(184,80,44,0.08)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e6dcc8' }}
              formatter={(v) => [String(v), a.dash.orders]} labelFormatter={(l) => `${l}:00`} />
            <Bar dataKey="orders" fill={HUE} maxBarSize={18} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs text-espresso-600">
        <summary className="cursor-pointer">Table</summary>
        <table className="num mt-2 w-full"><tbody>{rows.filter((r) => r.orders).map((r) => <tr key={r.hour}><td>{r.label}:00</td><td className="text-end">{r.orders}</td></tr>)}</tbody></table>
      </details>
      <span className="sr-only">{locale}</span>
    </>
  );
}
