'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { normalizeSaudiPhone } from '@/lib/phone';

/** Shown on the account page until the customer has a name (and, for Google accounts, a mobile). */
export function CompleteProfile({ name, phone }: { name: string | null; phone: string | null; phoneLocked?: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [n, setN] = useState(name ?? '');
  const [p, setP] = useState(phone ? `0${phone.slice(4)}` : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const needPhone = !phone;

  const save = async () => {
    if (n.trim().length < 2) return setMsg({ ok: false, text: t.checkout.invalidName });
    const e164 = needPhone ? normalizeSaudiPhone(p) : null;
    if (needPhone && !e164) return setMsg({ ok: false, text: t.checkout.invalidPhone });
    setBusy(true);
    const res = await fetch('/api/account/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: n.trim(), ...(e164 ? { phone: e164 } : {}) }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: t.errors[json.error as keyof typeof t.errors] ?? t.common.error });
    setMsg({ ok: true, text: t.account.saved });
    router.refresh();
  };

  return (
    <section className="rounded-[2rem] border border-gold-400/50 bg-gold-400/10 p-5" data-testid="complete-profile">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-2xl bg-espresso-800 text-cream-100"><UserRound className="size-5" /></span>
        <div><h2 className="font-bold">{t.account.completeTitle}</h2><p className="text-sm text-espresso-600">{t.account.completeText}</p></div>
      </div>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <input className="field" placeholder={t.account.yourName} autoComplete="name" value={n} onChange={(e) => setN(e.target.value)} maxLength={60} data-testid="profile-name" />
        {needPhone && <input className="field num" dir="ltr" inputMode="tel" autoComplete="tel" placeholder={t.checkout.phonePlaceholder} value={p} onChange={(e) => setP(e.target.value)} data-testid="profile-phone" />}
        <button className="btn btn-primary" disabled={busy} data-testid="profile-save">{busy ? t.common.loading : t.account.save}</button>
      </form>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${msg.ok ? 'text-ok-500' : 'text-danger-500'}`}>{msg.text}</p>}
    </section>
  );
}
