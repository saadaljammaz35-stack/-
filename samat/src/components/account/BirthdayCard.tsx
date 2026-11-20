'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cake } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n';

/** Asks for the birthday once, when the restaurant gives a birthday gift. */
export function BirthdayCard({ points }: { points: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [d, setD] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const max = new Date().toISOString().slice(0, 10);
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-[2rem] bg-terracotta-500/10 p-5" data-testid="birthday-card">
      <span className="grid size-10 place-items-center rounded-2xl bg-terracotta-500 text-white"><Cake className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{fill(t.account.birthdayTitle, { n: points })}</p>
        <p className="text-xs text-espresso-600">{t.account.birthdayText}</p>
      </div>
      <form className="flex gap-2" onSubmit={async (e) => {
        e.preventDefault();
        if (!d) return;
        setBusy(true); setErr(null);
        const res = await fetch('/api/account/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ birthday: d }) });
        setBusy(false);
        if (!res.ok) return setErr(t.common.error);
        router.refresh();
      }}>
        <input type="date" className="field min-h-10 py-1.5" max={max} min="1920-01-01" value={d} onChange={(e) => setD(e.target.value)} data-testid="birthday-input" />
        <button className="btn btn-sm btn-primary" disabled={busy || !d} data-testid="birthday-save">{t.account.save}</button>
      </form>
      {err && <p role="alert" className="w-full text-sm text-danger-500">{err}</p>}
    </section>
  );
}
