'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Smartphone } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { normalizeSaudiPhone } from '@/lib/phone';
import { browserDb } from '@/lib/supabase/browser';

export function PhoneLogin() {
  const { t } = useI18n();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e164 = normalizeSaudiPhone(phone);

  const send = async () => {
    if (!e164) return setError(t.checkout.invalidPhone);
    setBusy(true); setError(null);
    const { error: err } = await browserDb().auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (err) return setError(/sms|provider|hook/i.test(err.message) ? t.account.smsUnavailable : err.status === 429 ? t.errors.rate_limited : t.common.error);
    setSent(true);
  };
  const verify = async () => {
    setBusy(true); setError(null);
    const { error: err } = await browserDb().auth.verifyOtp({ phone: e164!, token: code.trim(), type: 'sms' });
    if (err) { setBusy(false); return setError(t.account.invalidCode); }
    await fetch('/api/account/profile', { method: 'POST' });
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/account');
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <div className="paper rounded-[2rem] p-7">
        <span className="grid size-12 place-items-center rounded-2xl bg-espresso-800 text-cream-100"><Smartphone className="size-6" /></span>
        <h1 className="mt-5 text-2xl font-bold">{t.account.signIn}</h1>
        <p className="mt-2 text-sm text-espresso-600">{t.account.signInText}</p>
        <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); if (sent) verify(); else send(); }}>
          <div>
            <label htmlFor="ph" className="label">{t.checkout.phone}</label>
            <input id="ph" className="field num" dir="ltr" inputMode="tel" autoComplete="tel" value={phone} disabled={sent}
              onChange={(e) => setPhone(e.target.value)} placeholder={t.checkout.phonePlaceholder} data-testid="login-phone" />
          </div>
          {sent && (
            <div>
              <label htmlFor="otp" className="label">{t.account.code}</label>
              <input id="otp" className="field num text-center text-2xl tracking-[0.5em]" dir="ltr" inputMode="numeric" autoComplete="one-time-code"
                maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} data-testid="login-code" />
              <p className="mt-1 text-xs text-ok-500">{t.account.codeSent}</p>
            </div>
          )}
          {error && <p role="alert" className="rounded-xl bg-danger-500/10 p-3 text-sm text-danger-500">{error}</p>}
          <button type="submit" className="btn btn-lg btn-primary w-full" disabled={busy || (sent && code.length < 6)} data-testid="login-submit">
            {busy ? t.common.loading : sent ? t.account.verify : t.account.sendCode}
          </button>
          {sent && <button type="button" className="btn btn-sm btn-ghost w-full" onClick={() => { setSent(false); setCode(''); }}>{t.account.resend}</button>}
        </form>
      </div>
    </div>
  );
}
