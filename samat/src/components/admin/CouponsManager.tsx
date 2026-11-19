'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, Sparkles, Ticket } from 'lucide-react';
import { useAdmin } from '@/lib/i18n/admin-client';
import { formatMoney } from '@/lib/money';

export interface CouponRow {
  id?: string; is_automatic: boolean; code: string | null; title_ar: string; title_en: string; kind: 'percent' | 'fixed'; value: number;
  max_discount: number | null; min_order: number; starts_at: string | null; ends_at: string | null; usage_limit: number | null; per_customer_limit: number | null;
  audience: 'all' | 'new_customers' | 'loyalty_members' | 'specific'; customer_phone: string | null; product_ids: string[] | null;
  category_kinds: ('burger' | 'shawarma' | 'fries')[] | null; is_active: boolean; used?: number;
}
const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 3 * 3600_000).toISOString().slice(0, 16) : '');
const fromLocal = (v: string) => (v ? new Date(`${v}:00+03:00`).toISOString() : null);

export function CouponsManager({ rows, products }: { rows: CouponRow[]; products: { id: string; name_ar: string; name_en: string }[] }) {
  const { a, locale } = useAdmin();
  const router = useRouter();
  const [edit, setEdit] = useState<CouponRow | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const blank = (auto: boolean): CouponRow => ({ is_automatic: auto, code: auto ? null : '', title_ar: '', title_en: '', kind: 'percent', value: 1000, max_discount: null, min_order: 0, starts_at: null, ends_at: null, usage_limit: null, per_customer_limit: auto ? null : 1, audience: 'all', customer_phone: null, product_ids: null, category_kinds: null, is_active: true });
  const save = async () => {
    const { used: _u, ...row } = edit!; void _u;
    const res = await fetch('/api/admin/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ row }) });
    const json = await res.json();
    setMsg(res.ok ? a.common.saved : `${a.common.error} ${json.detail?.issues?.join(', ') ?? ''}`);
    if (res.ok) { setEdit(null); router.refresh(); }
  };
  const num = (v: string) => (v === '' ? null : Number(v));
  const desc = (c: CouponRow) => (c.kind === 'percent' ? `${c.value / 100}%` : formatMoney(c.value, locale));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-primary" onClick={() => setEdit(blank(false))} data-testid="new-coupon"><Ticket className="size-4" /> {a.coupons.newCoupon}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setEdit(blank(true))}><Sparkles className="size-4" /> {a.coupons.newOffer}</button>
      </div>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      {edit && (
        <div className="paper grid gap-3 rounded-3xl p-5 sm:grid-cols-3" data-testid="coupon-form">
          {!edit.is_automatic && <label className="text-sm"><span className="label">{a.coupons.code}</span><input className="field uppercase" dir="ltr" value={edit.code ?? ''} onChange={(e) => setEdit({ ...edit, code: e.target.value })} data-testid="coupon-code" /></label>}
          <label className="text-sm"><span className="label">{a.coupons.titleAr}</span><input className="field" value={edit.title_ar} onChange={(e) => setEdit({ ...edit, title_ar: e.target.value })} data-testid="coupon-title-ar" /></label>
          <label className="text-sm"><span className="label">{a.coupons.titleEn}</span><input className="field" dir="ltr" value={edit.title_en} onChange={(e) => setEdit({ ...edit, title_en: e.target.value })} data-testid="coupon-title-en" /></label>
          <label className="text-sm"><span className="label">{a.coupons.kind}</span>
            <select className="field" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as CouponRow['kind'] })}><option value="percent">{a.coupons.percent}</option><option value="fixed">{a.coupons.fixed}</option></select></label>
          <label className="text-sm"><span className="label">{a.coupons.value} {edit.kind === 'percent' ? '%' : '(SAR)'}</span>
            <input className="field num" dir="ltr" value={edit.value / 100} onChange={(e) => setEdit({ ...edit, value: Math.round(Number(e.target.value) * 100) })} data-testid="coupon-value" /></label>
          <label className="text-sm"><span className="label">{a.coupons.maxDiscount}</span><input className="field num" dir="ltr" value={edit.max_discount == null ? '' : edit.max_discount / 100} onChange={(e) => setEdit({ ...edit, max_discount: e.target.value ? Math.round(Number(e.target.value) * 100) : null })} /></label>
          <label className="text-sm"><span className="label">{a.coupons.minOrder}</span><input className="field num" dir="ltr" value={edit.min_order / 100} onChange={(e) => setEdit({ ...edit, min_order: Math.round(Number(e.target.value || 0) * 100) })} /></label>
          <label className="text-sm"><span className="label">{a.coupons.starts}</span><input type="datetime-local" className="field" value={toLocal(edit.starts_at)} onChange={(e) => setEdit({ ...edit, starts_at: fromLocal(e.target.value) })} /></label>
          <label className="text-sm"><span className="label">{a.coupons.ends}</span><input type="datetime-local" className="field" value={toLocal(edit.ends_at)} onChange={(e) => setEdit({ ...edit, ends_at: fromLocal(e.target.value) })} /></label>
          <label className="text-sm"><span className="label">{a.coupons.usageLimit}</span><input type="number" min={1} className="field" value={edit.usage_limit ?? ''} onChange={(e) => setEdit({ ...edit, usage_limit: num(e.target.value) })} /></label>
          <label className="text-sm"><span className="label">{a.coupons.perCustomer}</span><input type="number" min={1} className="field" value={edit.per_customer_limit ?? ''} onChange={(e) => setEdit({ ...edit, per_customer_limit: num(e.target.value) })} /></label>
          <label className="text-sm"><span className="label">{a.coupons.audience}</span>
            <select className="field" value={edit.audience} onChange={(e) => setEdit({ ...edit, audience: e.target.value as CouponRow['audience'] })}>
              {Object.entries(a.coupons.aud).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          {edit.audience === 'specific' && <label className="text-sm"><span className="label">{a.coupons.phone}</span><input className="field" dir="ltr" value={edit.customer_phone ?? ''} onChange={(e) => setEdit({ ...edit, customer_phone: e.target.value })} /></label>}
          <label className="text-sm"><span className="label">{a.coupons.categories}</span>
            <select multiple className="field h-24" value={edit.category_kinds ?? []} onChange={(e) => setEdit({ ...edit, category_kinds: [...e.target.selectedOptions].map((o) => o.value as 'burger') })}>
              <option value="burger">Burger</option><option value="shawarma">Shawarma</option><option value="fries">Fries</option>
            </select></label>
          <label className="text-sm"><span className="label">{a.coupons.products}</span>
            <select multiple className="field h-24" value={edit.product_ids ?? []} onChange={(e) => setEdit({ ...edit, product_ids: [...e.target.selectedOptions].map((o) => o.value) })}>
              {products.map((p) => <option key={p.id} value={p.id}>{locale === 'ar' ? p.name_ar : p.name_en}</option>)}
            </select></label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-5" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> {a.coupons.active}</label>
          <div className="flex gap-2 sm:col-span-3">
            <button type="button" className="btn btn-primary" onClick={save} data-testid="coupon-save"><Save className="size-4" /> {a.common.save}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>{a.common.cancel}</button>
          </div>
        </div>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((c) => (
          <li key={c.id} className={`glass rounded-3xl p-4 ${c.is_active ? '' : 'opacity-50'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="num font-bold" dir="ltr">{c.is_automatic ? `✦ ${a.coupons.auto}` : c.code}</p>
                <p className="text-sm">{locale === 'ar' ? c.title_ar : c.title_en}</p>
              </div>
              <span className="chip bg-terracotta-500 text-white">{desc(c)}</span>
            </div>
            <p className="num mt-2 text-xs text-espresso-500">{a.coupons.used}: {c.used ?? 0}{c.usage_limit ? ` / ${c.usage_limit}` : ''} · {a.coupons.aud[c.audience]}</p>
            <button type="button" className="btn btn-sm btn-ghost mt-2" onClick={() => setEdit(c)}><Plus className="size-3 rotate-45" /> {a.common.edit}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
