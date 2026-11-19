'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { browserDb } from '@/lib/supabase/browser';
import { useAdmin } from '@/lib/i18n/admin-client';
import { useI18n } from '@/lib/i18n/client';
import { Logo } from '@/components/brand/Logo';

const MIN = 10;

export function SetupForm() {
  const { a } = useAdmin();
  const { t } = useI18n();
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(token.length < 20 ? a.setup.missing : null);

  const submit = async () => {
    if (password !== confirm) return setError(a.setup.mismatch);
    if (password.length < MIN) return setError(t.errors.weak_password);
    setBusy(true); setError(null);
    const res = await fetch('/api/admin/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
    const json = await res.json();
    if (!res.ok) { setBusy(false); return setError(t.errors[json.error as keyof typeof t.errors] ?? t.errors.unknown); }
    const db = browserDb();
    const { error: err } = await db.auth.signInWithPassword({ email: json.email, password });
    if (err) { setBusy(false); return setError(t.errors.unknown); }
    const boot = await (await fetch('/api/admin/bootstrap', { method: 'POST' })).json();
    if (!boot.ok) {
      await db.auth.signOut();
      setBusy(false);
      return setError(boot.reason === 'disabled' ? a.login.disabled : a.login.notStaff);
    }
    router.replace(boot.role === 'kitchen' ? '/kitchen' : '/admin');
    router.refresh();
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-espresso-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center text-cream-100"><Logo variant="full" height={120} /></div>
        <form className="glass-dark space-y-4 rounded-[2rem] p-7 text-cream-100" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="flex items-center gap-2"><LockKeyhole className="size-5 text-gold-400" /><h1 className="text-xl font-bold">{a.setup.title}</h1></div>
          <p className="text-sm text-cream-200/70">{a.setup.text}</p>
          <div>
            <label htmlFor="np" className="mb-1 block text-sm font-semibold">{a.setup.password}</label>
            <input id="np" type="password" dir="ltr" autoComplete="new-password" minLength={MIN} required className="field text-espresso-900"
              value={password} onChange={(e) => setPassword(e.target.value)} data-testid="setup-password" />
          </div>
          <div>
            <label htmlFor="cp" className="mb-1 block text-sm font-semibold">{a.setup.confirm}</label>
            <input id="cp" type="password" dir="ltr" autoComplete="new-password" minLength={MIN} required className="field text-espresso-900"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} data-testid="setup-confirm" />
          </div>
          {error && <p role="alert" className="rounded-xl bg-danger-500/20 p-3 text-sm" data-testid="setup-error">{error}</p>}
          <button className="btn btn-lg btn-cream w-full" disabled={busy || token.length < 20} data-testid="setup-submit">{busy ? '…' : a.setup.save}</button>
        </form>
      </div>
    </div>
  );
}
