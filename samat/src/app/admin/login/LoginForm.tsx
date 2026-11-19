'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { browserDb } from '@/lib/supabase/browser';
import { useAdmin } from '@/lib/i18n/admin-client';
import { Logo } from '@/components/brand/Logo';

export function LoginForm() {
  const { a } = useAdmin();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true); setError(null);
    const { error: err } = await browserDb().auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (err) return setError(err.status === 429 ? 'Too many attempts — wait a minute.' : err.message);
    setSent(true);
  };
  const verify = async () => {
    setBusy(true); setError(null);
    const db = browserDb();
    const { error: err } = await db.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    if (err) { setBusy(false); return setError(a.login.invalid); }
    const res = await fetch('/api/admin/bootstrap', { method: 'POST' });
    const json = await res.json();
    if (!json.ok) {
      await db.auth.signOut();
      setBusy(false);
      return setError(json.reason === 'disabled' ? a.login.disabled : json.reason === 'email_not_verified' ? a.login.notVerified : a.login.notStaff);
    }
    const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : json.role === 'kitchen' ? '/kitchen' : '/admin';
    router.replace(dest);
    router.refresh();
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-espresso-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center text-cream-100"><Logo variant="full" height={120} /></div>
        <form className="glass-dark space-y-4 rounded-[2rem] p-7 text-cream-100" onSubmit={(e) => { e.preventDefault(); if (sent) verify(); else send(); }}>
          <div className="flex items-center gap-2"><KeyRound className="size-5 text-gold-400" /><h1 className="text-xl font-bold">{a.login.title}</h1></div>
          <p className="text-sm text-cream-200/70">{a.login.text}</p>
          <div>
            <label htmlFor="em" className="mb-1 block text-sm font-semibold">{a.login.email}</label>
            <input id="em" type="email" dir="ltr" autoComplete="email" required className="field text-espresso-900" value={email} disabled={sent}
              onChange={(e) => setEmail(e.target.value)} data-testid="staff-email" />
          </div>
          {sent && (
            <div>
              <label htmlFor="cd" className="mb-1 block text-sm font-semibold">{a.login.code}</label>
              <input id="cd" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={8} className="field num text-center text-2xl tracking-[0.4em] text-espresso-900"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} data-testid="staff-code" />
              <p className="mt-1 text-xs text-gold-400">{a.login.sent}</p>
            </div>
          )}
          {error && <p role="alert" className="rounded-xl bg-danger-500/20 p-3 text-sm" data-testid="staff-login-error">{error}</p>}
          <button className="btn btn-lg btn-cream w-full" disabled={busy || (sent && code.length < 6)} data-testid="staff-submit">{busy ? '…' : sent ? a.login.verify : a.login.send}</button>
        </form>
      </div>
    </div>
  );
}
