'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { browserDb } from '@/lib/supabase/browser';
import { useAdmin } from '@/lib/i18n/admin-client';
import { Logo } from '@/components/brand/Logo';

type Mode = 'password' | 'code';

export function LoginForm() {
  const { a } = useAdmin();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const linkError = params.get('error');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'code' ? 'code' : 'password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    linkError === 'not_staff' ? a.login.notStaff : linkError === 'disabled' ? a.login.disabled : linkError ? a.login.linkFailed : null,
  );
  const normEmail = () => email.trim().toLowerCase();

  /** After any successful sign-in: grant/check the staff role, then go to the panel. */
  const finish = async () => {
    const res = await fetch('/api/admin/bootstrap', { method: 'POST' });
    const json = await res.json();
    if (!json.ok) {
      await browserDb().auth.signOut();
      setBusy(false);
      return setError(json.reason === 'disabled' ? a.login.disabled : json.reason === 'email_not_verified' ? a.login.notVerified : a.login.notStaff);
    }
    router.replace(safeNext ?? (json.role === 'kitchen' ? '/kitchen' : '/admin'));
    router.refresh();
  };

  const signInPassword = async () => {
    setBusy(true); setError(null);
    const { error: err } = await browserDb().auth.signInWithPassword({ email: normEmail(), password });
    if (err) { setBusy(false); return setError(err.status === 429 ? 'Too many attempts — wait a minute.' : a.login.wrongPassword); }
    await finish();
  };
  const sendCode = async () => {
    setBusy(true); setError(null);
    const { error: err } = await browserDb().auth.signInWithOtp({ email: normEmail(), options: {
      shouldCreateUser: true,
      emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext ?? '/admin')}`,
    } });
    setBusy(false);
    if (err) return setError(err.status === 429 ? 'Too many attempts — wait a minute.' : err.message);
    setSent(true);
  };
  const verifyCode = async () => {
    setBusy(true); setError(null);
    const { error: err } = await browserDb().auth.verifyOtp({ email: normEmail(), token: code.trim(), type: 'email' });
    if (err) { setBusy(false); return setError(a.login.invalid); }
    await finish();
  };
  const switchMode = (m: Mode) => { setMode(m); setSent(false); setCode(''); setError(null); };

  return (
    <div className="grid min-h-dvh place-items-center bg-espresso-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center text-cream-100"><Logo variant="full" height={120} /></div>
        <form className="glass-dark space-y-4 rounded-[2rem] p-7 text-cream-100" onSubmit={(e) => {
          e.preventDefault();
          if (mode === 'password') signInPassword(); else if (sent) verifyCode(); else sendCode();
        }}>
          <div className="flex items-center gap-2"><KeyRound className="size-5 text-gold-400" /><h1 className="text-xl font-bold">{a.login.title}</h1></div>
          <p className="text-sm text-cream-200/70">{mode === 'password' ? a.login.text : a.login.textCode}</p>
          <div>
            <label htmlFor="em" className="mb-1 block text-sm font-semibold">{a.login.email}</label>
            <input id="em" type="email" dir="ltr" autoComplete="username" required className="field text-espresso-900" value={email} disabled={sent}
              onChange={(e) => setEmail(e.target.value)} data-testid="staff-email" />
          </div>
          {mode === 'password' && (
            <div>
              <label htmlFor="pw" className="mb-1 block text-sm font-semibold">{a.login.password}</label>
              <input id="pw" type="password" dir="ltr" autoComplete="current-password" required className="field text-espresso-900" value={password}
                onChange={(e) => setPassword(e.target.value)} data-testid="staff-password" />
            </div>
          )}
          {mode === 'code' && sent && (
            <div>
              <label htmlFor="cd" className="mb-1 block text-sm font-semibold">{a.login.code}</label>
              <input id="cd" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={8} className="field num text-center text-2xl tracking-[0.4em] text-espresso-900"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} data-testid="staff-code" />
              <p className="mt-1 text-xs text-gold-400">{a.login.sent}</p>
            </div>
          )}
          {error && <p role="alert" className="rounded-xl bg-danger-500/20 p-3 text-sm" data-testid="staff-login-error">{error}</p>}
          <button className="btn btn-lg btn-cream w-full" data-testid="staff-submit"
            disabled={busy || (mode === 'password' ? !password : sent && code.length < 6)}>
            {busy ? '…' : mode === 'password' ? a.login.signIn : sent ? a.login.verify : a.login.send}
          </button>
          <div className="space-y-2 text-center text-xs text-cream-200/70">
            <button type="button" className="underline underline-offset-4" onClick={() => switchMode(mode === 'password' ? 'code' : 'password')} data-testid="staff-mode">
              {mode === 'password' ? a.login.useCode : a.login.usePassword}
            </button>
            {mode === 'password' && <p>{a.login.forgot}</p>}
          </div>
        </form>
      </div>
    </div>
  );
}
