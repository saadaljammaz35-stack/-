'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Save } from 'lucide-react';
import { useAdmin } from '@/lib/i18n/admin-client';
import { useI18n } from '@/lib/i18n/client';

interface Reward { id?: string; name_ar: string; name_en: string; description_ar: string | null; description_en: string | null; points_cost: number; reward_type: 'discount_fixed' | 'free_product'; value: number | null; product_id: string | null; is_active: boolean; sort_order: number }

export function LoyaltyManager({ settings, rewards, products, members }: {
  settings: { loyalty_enabled: boolean; loyalty_points_per_sar: number; loyalty_point_value_halalas: number; loyalty_min_redeem_points: number; loyalty_expiry_days: number | null; loyalty_welcome_points: number; loyalty_birthday_points: number; loyalty_stamp_target: number; loyalty_stamp_reward_points: number };
  rewards: Reward[]; products: { id: string; name_ar: string; name_en: string }[]; members: { count: number; points: number };
}) {
  const { a, locale } = useAdmin();
  const { t } = useI18n();
  const router = useRouter();
  const [s, setS] = useState({ ...settings, loyalty_expiry_days: settings.loyalty_expiry_days ?? 0 });
  const [edit, setEdit] = useState<Reward | null>(null);
  const [adj, setAdj] = useState({ phone: '', points: '', note: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const post = async (body: unknown) => {
    const res = await fetch('/api/admin/loyalty', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    setMsg(res.ok ? `${a.common.saved}${json.balance !== undefined ? ` — ${a.loyalty.balance}: ${json.balance}` : ''}` : t.errors[json.error as keyof typeof t.errors] ?? a.common.error);
    router.refresh();
    return res.ok;
  };
  const numIn = (k: keyof typeof s, label: string, step = '1') => (
    <label className="text-sm"><span className="label">{label}</span>
      <input type="number" step={step} min={0} className="field" value={Number(s[k])} onChange={(e) => setS({ ...s, [k]: Number(e.target.value) })} /></label>
  );
  return (
    <div className="space-y-5">
      <p className="rounded-2xl bg-gold-400/15 p-4 text-sm">{a.loyalty.rules}</p>
      {msg && <p role="status" className="text-sm" data-testid="loyalty-msg">{msg}</p>}
      <section className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-3"><input type="checkbox" className="size-5" checked={s.loyalty_enabled} onChange={(e) => setS({ ...s, loyalty_enabled: e.target.checked })} data-testid="loyalty-enabled" /> {a.loyalty.enabled}</label>
        {numIn('loyalty_points_per_sar', a.loyalty.perSar, '0.1')}{numIn('loyalty_point_value_halalas', a.loyalty.pointValue)}{numIn('loyalty_min_redeem_points', a.loyalty.minRedeem)}
        <label className="text-sm"><span className="label">{a.loyalty.expiry}</span>
          <input type="number" min={0} className="field" value={s.loyalty_expiry_days} onChange={(e) => setS({ ...s, loyalty_expiry_days: Number(e.target.value) })} />
          <span className="text-xs text-espresso-500">{a.loyalty.expiryHint} (0)</span></label>
        <label className="text-sm"><span className="label">{a.loyalty.welcome}</span>
          <input type="number" min={0} className="field" value={s.loyalty_welcome_points} onChange={(e) => setS({ ...s, loyalty_welcome_points: Number(e.target.value) })} data-testid="loyalty-welcome" />
          <span className="text-xs text-espresso-500">{a.loyalty.welcomeHint}</span></label>
        <label className="text-sm"><span className="label">{a.loyalty.birthday}</span>
          <input type="number" min={0} className="field" value={s.loyalty_birthday_points} onChange={(e) => setS({ ...s, loyalty_birthday_points: Number(e.target.value) })} data-testid="loyalty-birthday" />
          <span className="text-xs text-espresso-500">{a.loyalty.birthdayHint}</span></label>
        <label className="text-sm"><span className="label">{a.loyalty.stampTarget}</span>
          <input type="number" min={0} max={100} className="field" value={s.loyalty_stamp_target} onChange={(e) => setS({ ...s, loyalty_stamp_target: Number(e.target.value) })} data-testid="loyalty-stamp-target" />
          <span className="text-xs text-espresso-500">{a.loyalty.stampTargetHint}</span></label>
        <label className="text-sm"><span className="label">{a.loyalty.stampReward}</span>
          <input type="number" min={0} className="field" value={s.loyalty_stamp_reward_points} onChange={(e) => setS({ ...s, loyalty_stamp_reward_points: Number(e.target.value) })} data-testid="loyalty-stamp-reward" /></label>
        <div className="sm:col-span-3"><button type="button" className="btn btn-primary" onClick={() => post({ action: 'settings', ...s })} data-testid="loyalty-save"><Save className="size-4" /> {a.common.save}</button></div>
        <p className="num text-sm text-espresso-600 sm:col-span-3">{a.loyalty.members}: {members.count} · {members.points} pts</p>
      </section>

      <section className="glass rounded-3xl p-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{a.loyalty.rewards}</h2>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEdit({ name_ar: '', name_en: '', description_ar: null, description_en: null, points_cost: 100, reward_type: 'discount_fixed', value: 500, product_id: null, is_active: true, sort_order: rewards.length })}><Gift className="size-4" /> {a.loyalty.newReward}</button></div>
        {edit && (
          <div className="paper mb-3 grid gap-3 rounded-2xl p-4 sm:grid-cols-3">
            <input className="field" placeholder={a.menu.nameAr} value={edit.name_ar} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} />
            <input className="field" dir="ltr" placeholder={a.menu.nameEn} value={edit.name_en} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} />
            <label className="text-sm"><span className="label">{a.loyalty.cost}</span><input type="number" min={1} className="field" value={edit.points_cost} onChange={(e) => setEdit({ ...edit, points_cost: Number(e.target.value) })} /></label>
            <select className="field" value={edit.reward_type} onChange={(e) => setEdit({ ...edit, reward_type: e.target.value as Reward['reward_type'] })}>
              <option value="discount_fixed">{a.loyalty.discount}</option><option value="free_product">{a.loyalty.freeProduct}</option>
            </select>
            {edit.reward_type === 'discount_fixed'
              ? <label className="text-sm"><span className="label">{a.coupons.value} (SAR)</span><input className="field num" dir="ltr" value={(edit.value ?? 0) / 100} onChange={(e) => setEdit({ ...edit, value: Math.round(Number(e.target.value) * 100) || null })} /></label>
              : <select className="field" value={edit.product_id ?? ''} onChange={(e) => setEdit({ ...edit, product_id: e.target.value || null })}><option value="">{a.loyalty.product}</option>{products.map((p) => <option key={p.id} value={p.id}>{locale === 'ar' ? p.name_ar : p.name_en}</option>)}</select>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> {a.coupons.active}</label>
            <div className="flex gap-2 sm:col-span-3">
              <button type="button" className="btn btn-primary" onClick={async () => { if (await post({ action: 'reward', row: { ...edit, value: edit.reward_type === 'discount_fixed' ? edit.value : null, product_id: edit.reward_type === 'free_product' ? edit.product_id : null } })) setEdit(null); }}><Save className="size-4" /> {a.common.save}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>{a.common.cancel}</button>
            </div>
          </div>
        )}
        <ul className="grid gap-2 sm:grid-cols-2">
          {rewards.map((r) => (
            <li key={r.id} className={`flex items-center justify-between rounded-2xl bg-cream-100/70 p-3 ${r.is_active ? '' : 'opacity-50'}`}>
              <span><strong>{locale === 'ar' ? r.name_ar : r.name_en}</strong> <span className="num text-sm text-espresso-500">· {r.points_cost} pts</span></span>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEdit(r)}>{a.common.edit}</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-[1fr_8rem_1fr_auto]">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-4"><h2 className="font-bold">{a.loyalty.adjust}</h2>
          <Link href="/admin/customers" className="btn btn-sm btn-primary">{a.loyalty.openCustomers}</Link></div>
        <input className="field" dir="ltr" placeholder={a.loyalty.customerPhone} value={adj.phone} onChange={(e) => setAdj({ ...adj, phone: e.target.value })} />
        <input className="field num" dir="ltr" placeholder={a.loyalty.points} value={adj.points} onChange={(e) => setAdj({ ...adj, points: e.target.value })} />
        <input className="field" placeholder={a.inv.note} value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} />
        <button type="button" className="btn btn-primary" onClick={() => post({ action: 'adjust', phone: adj.phone, points: Number(adj.points), note: adj.note || 'Manual adjustment' })}>{a.inv.apply}</button>
      </section>
    </div>
  );
}
