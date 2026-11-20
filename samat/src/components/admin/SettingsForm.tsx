'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useAdmin } from '@/lib/i18n/admin-client';
import { ImageInput } from './ImageInput';

type S = Record<string, unknown> & { opening_hours: Record<string, { open: string; close: string }[]>; payment_methods: Record<string, boolean>; admin_notification_emails: string[] };
const DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const;
const DAY_AR: Record<string, string> = { sun: 'الأحد', mon: 'الاثنين', tue: 'الثلاثاء', wed: 'الأربعاء', thu: 'الخميس', fri: 'الجمعة', sat: 'السبت' };

export function SettingsForm({ initial }: { initial: S }) {
  const { a, locale } = useAdmin();
  const router = useRouter();
  const [s, setS] = useState<S>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setS((x) => ({ ...x, [k]: v }));
  const txt = (k: string, label: string, props: Record<string, unknown> = {}) => (
    <label className="text-sm"><span className="label">{label}</span>
      <input className="field" value={String(s[k] ?? '')} onChange={(e) => set(k, e.target.value)} {...props} /></label>
  );
  const num = (k: string, label: string) => (
    <label className="text-sm"><span className="label">{label}</span>
      <input type="number" className="field" value={Number(s[k] ?? 0)} onChange={(e) => set(k, Number(e.target.value))} /></label>
  );
  const chk = (k: string, label: string, obj?: 'payment_methods') => (
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input type="checkbox" className="size-5" checked={obj ? Boolean(s.payment_methods[k]) : Boolean(s[k])}
        onChange={(e) => (obj ? set('payment_methods', { ...s.payment_methods, [k]: e.target.checked }) : set(k, e.target.checked))} data-testid={`set-${k}`} /> {label}
    </label>
  );

  const save = async () => {
    setBusy(true); setMsg(null);
    const body = { ...s, latitude: s.latitude === '' || s.latitude == null ? null : Number(s.latitude), longitude: s.longitude === '' || s.longitude == null ? null : Number(s.longitude) };
    delete (body as Record<string, unknown>).updated_at; delete (body as Record<string, unknown>).id; delete (body as Record<string, unknown>).low_alert_sent_at;
    for (const k of ['accepting_orders', 'pause_message_ar', 'pause_message_en', 'busy_mode', 'busy_extra_minutes', 'busy_message_ar', 'busy_message_en', 'max_active_orders', 'card_networks', 'timezone', 'loyalty_enabled', 'loyalty_points_per_sar', 'loyalty_point_value_halalas', 'loyalty_min_redeem_points', 'loyalty_expiry_days']) delete (body as Record<string, unknown>)[k];
    const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: a.settings.saved } : { ok: false, text: `${a.common.error}: ${json.detail?.issues?.join(', ') ?? json.error}` });
    if (res.ok) router.refresh();
  };

  return (
    <div className="space-y-5 pb-24" data-testid="settings">
      <section className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">{a.settings.branch}</h2>
        {txt('branch_name_ar', a.settings.nameAr)}{txt('branch_name_en', a.settings.nameEn, { dir: 'ltr' })}
        {txt('address_ar', a.settings.addressAr)}{txt('address_en', a.settings.addressEn, { dir: 'ltr' })}
        {txt('maps_url', a.settings.maps, { dir: 'ltr' })}{txt('phone', a.settings.phone, { dir: 'ltr' })}{txt('whatsapp_number', a.settings.whatsapp, { dir: 'ltr' })}
        {txt('latitude', a.settings.lat, { dir: 'ltr' })}{txt('longitude', a.settings.lng, { dir: 'ltr' })}
        {txt('pickup_instructions_ar', a.settings.pickupAr)}{txt('pickup_instructions_en', a.settings.pickupEn, { dir: 'ltr' })}
      </section>

      <section className="glass rounded-3xl p-5">
        <h2 className="mb-3 font-bold">{a.settings.hours}</h2>
        <div className="space-y-2">
          {DAYS.map((d) => {
            const slots = s.opening_hours[d] ?? [];
            const upd = (v: { open: string; close: string }[]) => set('opening_hours', { ...s.opening_hours, [d]: v });
            return (
              <div key={d} className="flex flex-wrap items-center gap-2">
                <span className="w-24 text-sm font-semibold">{locale === 'ar' ? DAY_AR[d] : d.toUpperCase()}</span>
                {slots.length === 0 && <span className="text-sm text-espresso-500">{a.settings.closedDay}</span>}
                {slots.map((sl, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <input type="time" className="field min-h-10 w-28 py-1" value={sl.open} onChange={(e) => upd(slots.map((x, k) => (k === i ? { ...x, open: e.target.value } : x)))} aria-label={a.settings.open} />
                    –
                    <input type="time" className="field min-h-10 w-28 py-1" value={sl.close} onChange={(e) => upd(slots.map((x, k) => (k === i ? { ...x, close: e.target.value } : x)))} aria-label={a.settings.close} />
                    <button type="button" className="p-1 text-danger-500" onClick={() => upd(slots.filter((_, k) => k !== i))}><Trash2 className="size-4" /></button>
                  </span>
                ))}
                {slots.length < 3 && <button type="button" className="btn btn-sm btn-ghost" onClick={() => upd([...slots, { open: '12:00', close: '23:59' }])}><Plus className="size-4" /></button>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-3">
        <h2 className="font-bold sm:col-span-3">{a.settings.ordering}</h2>
        {num('base_prep_minutes', a.settings.prep)}{num('kitchen_late_minutes', a.settings.late)}{num('unpaid_order_ttl_minutes', a.settings.ttl)}
        {chk('pickup_screen_enabled', a.settings.pickupScreen)}{chk('demo_banner', a.settings.demo)}
      </section>

      <section className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">{a.settings.notify}</h2>
        <label className="text-sm sm:col-span-2"><span className="label">{a.settings.adminEmails}</span>
          <input className="field" dir="ltr" value={s.admin_notification_emails.join(', ')} onChange={(e) => set('admin_notification_emails', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} data-testid="set-emails" /></label>
        {chk('low_stock_alerts', a.settings.lowStock)}
      </section>

      <section className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">{a.settings.tax}</h2>
        {txt('legal_name', a.settings.legal)}{txt('vat_number', a.settings.vat, { dir: 'ltr', inputMode: 'numeric' })}
        {txt('cr_number', a.settings.cr, { dir: 'ltr' })}
        <label className="text-sm"><span className="label">{a.settings.vatRate}</span>
          <input type="number" step="0.01" className="field" value={Number(s.vat_rate_bps ?? 0) / 100} onChange={(e) => set('vat_rate_bps', Math.round(Number(e.target.value) * 100))} /></label>
        {chk('vat_enabled', a.settings.vatOn)}{chk('prices_include_vat', a.settings.inclusive)}
        {txt('invoice_footer_ar', a.settings.footerAr)}{txt('invoice_footer_en', a.settings.footerEn, { dir: 'ltr' })}
      </section>

      <section className="glass grid gap-3 rounded-3xl p-5 sm:grid-cols-2">
        <h2 className="font-bold sm:col-span-2">{a.settings.payments}</h2>
        <p className="text-xs text-espresso-500 sm:col-span-2">{a.settings.paymentsHint}</p>
        {chk('bank_transfer', a.settings.bank_transfer, 'payment_methods')}
        {chk('creditcard', a.settings.creditcard, 'payment_methods')}
        {chk('applepay', a.settings.applepay, 'payment_methods')}
        {chk('stcpay', a.settings.stcpay, 'payment_methods')}
        {chk('manual_capture', a.settings.manual)}
        <h3 className="mt-2 font-semibold sm:col-span-2">{a.settings.bankDetails}</h3>
        {txt('bank_name', a.settings.bankName)}{txt('bank_account_name', a.settings.bankAccountName)}
        {txt('bank_iban', a.settings.bankIban, { dir: 'ltr' })}{txt('bank_account_number', a.settings.bankAccount, { dir: 'ltr' })}
        {txt('bank_swift', a.settings.bankSwift, { dir: 'ltr' })}
        <ImageInput name="bank_qr_url" label={a.settings.bankQr} defaultValue={String(s.bank_qr_url ?? '')} bucket="assets" folder="payment" onChange={(v) => set('bank_qr_url', v)} />
      </section>

      <div className="glass fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-3xl items-center gap-3 rounded-full p-2 shadow-lift lg:ms-[260px]">
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy} data-testid="settings-save"><Save className="size-4" /> {busy ? a.common.loading : a.common.save}</button>
        {msg && <span role="status" className={`text-sm ${msg.ok ? 'text-ok-500' : 'text-danger-500'}`} data-testid="settings-msg">{msg.text}</span>}
      </div>
    </div>
  );
}
