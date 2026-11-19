'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Plus, Save } from 'lucide-react';
import { useAdmin } from '@/lib/i18n/admin-client';
import { useI18n } from '@/lib/i18n/client';
import { fmtDateTime } from '@/lib/time';

export interface InvRow { id: string; name_ar: string; name_en: string; group: string; unit: string; on_hand: number; reserved: number; available: number; low_threshold: number; is_active: boolean; sold_30d: number; is_low: boolean }
interface Movement { id: number; inventory_id: string; movement: string; quantity: number; balance_after: number; note: string | null; created_at: string }

export function InventoryManager({ rows, movements }: { rows: InvRow[]; movements: Movement[] }) {
  const { a, locale } = useAdmin();
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState<Record<string, unknown> | null>(null);
  const [move, setMove] = useState<{ id: string; type: 'purchase' | 'waste' | 'adjustment' | 'count'; qty: string; note: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const n = (r: { name_ar: string; name_en: string }) => (locale === 'ar' ? r.name_ar : r.name_en);

  const post = async (body: unknown) => {
    const res = await fetch('/api/admin/inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) { setMsg(t.errors[json.error as keyof typeof t.errors] ?? a.common.error); return false; }
    setMsg(a.common.saved);
    router.refresh();
    return true;
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button type="button" className="btn btn-primary" onClick={() => setForm({ name_ar: '', name_en: '', group_key: 'extra', unit: 'portion', low_threshold: 0, is_active: true })}><Plus className="size-4" /> {a.inv.newItem}</button>
      </div>
      {msg && <p role="status" className="text-sm" data-testid="inv-msg">{msg}</p>}
      {form && (
        <div className="paper grid gap-3 rounded-3xl p-5 sm:grid-cols-3">
          {(['name_ar', 'name_en'] as const).map((k) => (
            <label key={k} className="text-sm"><span className="label">{k === 'name_ar' ? a.menu.nameAr : a.menu.nameEn}</span>
              <input className="field" value={String(form[k] ?? '')} onChange={(e) => setForm({ ...form, [k]: e.target.value })} data-testid={`inv-${k}`} /></label>
          ))}
          <label className="text-sm"><span className="label">{a.inv.group}</span>
            <select className="field" value={String(form.group_key)} onChange={(e) => setForm({ ...form, group_key: e.target.value })}>
              {Object.entries(a.inv.groups).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          <label className="text-sm"><span className="label">{a.inv.unit}</span>
            <select className="field" value={String(form.unit)} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {['portion', 'piece', 'g', 'kg', 'ml', 'l'].map((u) => <option key={u} value={u}>{u}</option>)}
            </select></label>
          <label className="text-sm"><span className="label">{a.inv.threshold}</span>
            <input type="number" min={0} className="field" value={Number(form.low_threshold)} onChange={(e) => setForm({ ...form, low_threshold: Number(e.target.value) })} /></label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-5" checked={Boolean(form.is_active)} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> {a.menu.available}</label>
          <div className="flex gap-2 sm:col-span-3">
            <button type="button" className="btn btn-primary" onClick={async () => { if (await post({ action: 'save', item: form })) setForm(null); }} data-testid="inv-save"><Save className="size-4" /> {a.common.save}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>{a.common.cancel}</button>
          </div>
        </div>
      )}

      <div className="glass overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-start text-xs text-espresso-500">
            <tr className="border-b hairline">
              {[a.inv.name, a.inv.group, a.inv.onHand, a.inv.reserved, a.inv.available, a.inv.threshold, a.inv.sold30, ''].map((h, i) => <th key={i} className="px-3 py-3 text-start font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-b hairline ${r.is_active ? '' : 'opacity-50'}`} data-testid={`inv-row-${r.name_en}`}>
                <td className="px-3 py-2.5 font-semibold">{n(r)}</td>
                <td className="px-3">{a.inv.groups[r.group as keyof typeof a.inv.groups]}</td>
                <td className="num px-3">{Number(r.on_hand)} <span className="text-xs text-espresso-500">{r.unit}</span></td>
                <td className="num px-3">{Number(r.reserved)}</td>
                <td className="num px-3 font-bold" data-testid="inv-available">
                  {Number(r.available) <= 0 ? <span className="chip bg-danger-500 text-white">{a.inv.out}</span> : r.is_low ? <span className="chip bg-warn-500/20"><AlertTriangle className="size-3" /> {Number(r.available)}</span> : Number(r.available)}
                </td>
                <td className="num px-3">{Number(r.low_threshold)}</td>
                <td className="num px-3">{Number(r.sold_30d)}</td>
                <td className="px-3">
                  <div className="flex gap-1">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMove({ id: r.id, type: 'purchase', qty: '', note: '' })} data-testid="inv-move">{a.inv.movement}</button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setForm({ id: r.id, name_ar: r.name_ar, name_en: r.name_en, group_key: r.group, unit: r.unit, low_threshold: Number(r.low_threshold), is_active: r.is_active })}>{a.common.edit}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {move && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="paper w-full max-w-md space-y-3 rounded-3xl p-5">
            <h3 className="font-bold">{a.inv.movement} — {n(rows.find((r) => r.id === move.id)!)}</h3>
            <select className="field" value={move.type} onChange={(e) => setMove({ ...move, type: e.target.value as typeof move.type })} data-testid="inv-move-type">
              <option value="purchase">{a.inv.purchase}</option><option value="waste">{a.inv.waste}</option>
              <option value="adjustment">{a.inv.adjustment} (+/-)</option><option value="count">{a.inv.count}</option>
            </select>
            <input className="field num" dir="ltr" inputMode="decimal" placeholder={a.inv.qty} value={move.qty} onChange={(e) => setMove({ ...move, qty: e.target.value })} data-testid="inv-move-qty" />
            <input className="field" placeholder={a.inv.note} value={move.note} onChange={(e) => setMove({ ...move, note: e.target.value })} />
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary" data-testid="inv-move-apply" onClick={async () => {
                const q = Number(move.qty);
                if (!Number.isFinite(q)) return;
                const ok = move.type === 'count' ? await post({ action: 'count', id: move.id, count: q, note: move.note || undefined })
                  : await post({ action: 'move', id: move.id, movement: move.type, quantity: q, note: move.note || undefined });
                if (ok) setMove(null);
              }}>{a.inv.apply}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setMove(null)}>{a.common.cancel}</button>
            </div>
          </div>
        </div>
      )}

      <section className="glass rounded-3xl p-5">
        <h2 className="mb-3 font-bold">{a.inv.history}</h2>
        <ul className="divide-y hairline text-sm">
          {movements.map((m) => {
            const r = rows.find((x) => x.id === m.inventory_id);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="num text-xs text-espresso-500" dir="ltr">{fmtDateTime(m.created_at, locale)}</span>
                <span className="font-semibold">{r ? n(r) : ''}</span>
                <span className="chip bg-sand-300/60">{m.movement}</span>
                <span className={`num font-bold ${Number(m.quantity) > 0 ? 'text-ok-500' : 'text-danger-500'}`} dir="ltr">{Number(m.quantity) > 0 ? '+' : ''}{Number(m.quantity)}</span>
                <span className="num text-xs text-espresso-500">→ {Number(m.balance_after)}</span>
                {m.note && <span className="text-xs text-espresso-500">{m.note}</span>}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
