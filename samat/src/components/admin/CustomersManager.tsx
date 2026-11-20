'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Gift, Minus, Plus, Search, Smartphone, X } from 'lucide-react';
import { useAdmin } from '@/lib/i18n/admin-client';
import { useI18n } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { fmtDateTime } from '@/lib/time';

export interface CustomerRow {
  id: string; full_name: string | null; phone: string | null; email: string | null; via: 'google' | 'phone' | 'other';
  balance: number; lifetime_earned: number; orders: number; spent: number; last_order_at: string | null; joined_at: string; total_count: number;
}

const QUICK = [10, 25, 50, 100];

export function CustomersManager({ rows, total, q, sort, page, pageSize, pointValue }: {
  rows: CustomerRow[]; total: number; q: string; sort: string; page: number; pageSize: number; pointValue: number;
}) {
  const { a, locale } = useAdmin();
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [points, setPoints] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (o: Record<string, string | number>) => {
    const sp = new URLSearchParams({ ...(q ? { q } : {}), sort, page: String(page), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) });
    return `/admin/customers?${sp.toString()}`;
  };

  const apply = async (c: CustomerRow, sign: 1 | -1) => {
    const n = Math.abs(Math.trunc(Number(points)));
    if (!n) return;
    setBusy(true);
    const res = await fetch('/api/admin/loyalty', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'adjust_customer', customer_id: c.id, points: sign * n, note: note.trim() || (sign > 0 ? a.customers.gift : a.customers.deduct) }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ id: c.id, ok: false, text: t.errors[json.error as keyof typeof t.errors] ?? a.common.error });
    setMsg({ id: c.id, ok: true, text: fill(a.customers.done, { n: `${sign > 0 ? '+' : '−'}${n}`, balance: json.balance }) });
    setPoints(''); setNote('');
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form className="flex min-w-0 flex-1 basis-full gap-2 sm:basis-auto" action="/admin/customers">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-espresso-400" />
            <input name="q" defaultValue={q} className="field ps-9" placeholder={a.customers.search} data-testid="customers-search" />
          </div>
          <input type="hidden" name="sort" value={sort} />
          <button className="btn btn-primary">{a.customers.find}</button>
        </form>
        <a href="/api/admin/customers/export" className="btn btn-ghost" data-testid="customers-export"><Download className="size-4" /> {a.customers.export}</a>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-espresso-500">{fill(a.customers.count, { n: total })}</span>
        <span className="mx-1 text-espresso-300">·</span>
        {(['recent', 'points', 'spent', 'orders'] as const).map((k) => (
          <Link key={k} href={href({ sort: k, page: 1 })} className={`rounded-full px-3 py-1 ${sort === k ? 'bg-espresso-800 text-cream-100' : 'bg-cream-100 text-espresso-700'}`}>
            {a.customers.sorts[k]}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="paper rounded-3xl p-6 text-espresso-600">{q ? a.customers.noMatch : a.customers.empty}</p>
      ) : (
        <ul className="space-y-3" data-testid="customers-list">
          {rows.map((c) => (
            <li key={c.id} className="glass rounded-3xl p-4" data-testid="customer-row">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${c.via === 'google' ? 'bg-white text-[#4285F4] ring-1 ring-sand-300' : 'bg-espresso-800 text-cream-100'}`}>
                  {c.via === 'google' ? <span className="text-lg font-bold">G</span> : <Smartphone className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{c.full_name || a.customers.noName}</p>
                  <p className="truncate text-xs text-espresso-500" dir="ltr">{[c.phone, c.email].filter(Boolean).join(' · ') || '—'}</p>
                </div>
                <div className="text-end">
                  <p className="num text-xl font-bold text-terracotta-500" data-testid="customer-balance">{c.balance}</p>
                  <p className="text-[11px] text-espresso-500">{a.customers.points}{pointValue ? ` ≈ ${formatMoney(c.balance * pointValue, locale)}` : ''}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-espresso-600">
                <span>{fill(a.customers.ordersN, { n: c.orders })}</span>
                <span>{a.customers.spent}: <b className="num">{formatMoney(Number(c.spent), locale)}</b></span>
                {c.last_order_at && <span>{a.customers.lastOrder}: {fmtDateTime(c.last_order_at, locale)}</span>}
                <span>{a.customers.joined}: {fmtDateTime(c.joined_at, locale)}</span>
                {c.phone && <Link className="underline" href={`/admin/orders?status=all&q=${encodeURIComponent(c.phone)}`}>{a.customers.viewOrders}</Link>}
                <button type="button" className="btn btn-sm btn-primary ms-auto" onClick={() => { setOpen(open === c.id ? null : c.id); setMsg(null); setPoints(''); setNote(''); }} data-testid="customer-points">
                  {open === c.id ? <X className="size-4" /> : <Gift className="size-4" />} {a.customers.addPoints}
                </button>
              </div>
              {open === c.id && (
                <div className="mt-3 space-y-3 rounded-2xl bg-cream-100/80 p-3">
                  <div className="flex flex-wrap gap-2">
                    {QUICK.map((n) => (
                      <button key={n} type="button" className={`num rounded-full px-3 py-1.5 text-sm font-semibold ${points === String(n) ? 'bg-terracotta-500 text-white' : 'bg-white'}`} onClick={() => setPoints(String(n))}>{n}</button>
                    ))}
                    <input type="number" min={1} inputMode="numeric" className="field num w-28" placeholder={a.customers.custom} value={points} onChange={(e) => setPoints(e.target.value)} data-testid="points-amount" />
                  </div>
                  <input className="field" maxLength={200} placeholder={a.customers.reason} value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-accent flex-1" disabled={busy || !Number(points)} onClick={() => apply(c, 1)} data-testid="points-add"><Plus className="size-4" /> {a.customers.add}</button>
                    <button type="button" className="btn btn-ghost" disabled={busy || !Number(points)} onClick={() => apply(c, -1)}><Minus className="size-4" /> {a.customers.remove}</button>
                  </div>
                </div>
              )}
              {msg?.id === c.id && <p role="status" className={`mt-2 text-sm ${msg.ok ? 'text-ok-500' : 'text-danger-500'}`} data-testid="points-msg">{msg.text}</p>}
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link className="btn btn-sm btn-ghost" href={href({ page: page - 1 })}>{a.customers.prev}</Link>}
          <span className="num text-espresso-500">{page} / {pages}</span>
          {page < pages && <Link className="btn btn-sm btn-ghost" href={href({ page: page + 1 })}>{a.customers.next}</Link>}
        </nav>
      )}
    </div>
  );
}
