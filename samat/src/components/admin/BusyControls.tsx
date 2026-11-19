'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Pause, Play } from 'lucide-react';
import { useAdmin } from '@/lib/i18n/admin-client';
import type { StoreState } from '@/lib/catalog-types';

export function BusyControls({ state, settings }: {
  state: StoreState;
  settings: { busy_extra_minutes: number; max_active_orders: number | null; pause_message_ar: string | null; busy_message_ar: string | null };
}) {
  const { a } = useAdmin();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState(settings.busy_extra_minutes);
  const [max, setMax] = useState(settings.max_active_orders ?? '');
  const [pauseMsg, setPauseMsg] = useState(settings.pause_message_ar ?? '');
  const [busyMsg, setBusyMsg] = useState(settings.busy_message_ar ?? '');
  const [msg, setMsg] = useState<string | null>(null);

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch('/api/admin/ordering', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    setMsg(res.ok ? a.busy.saved : a.common.error);
    router.refresh();
  };

  return (
    <section className={`rounded-3xl p-5 ${!state.accepting_orders ? 'bg-danger-500 text-white' : state.busy_mode ? 'bg-warn-500 text-espresso-900' : 'bg-espresso-900 text-cream-100'}`} data-testid="busy-controls">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold opacity-75">{a.busy.title}</p>
          <p className="text-xl font-bold" data-testid="ordering-state">{!state.accepting_orders ? a.busy.paused : state.busy_mode ? a.busy.busyOn : a.busy.accepting}</p>
          <p className="num text-sm opacity-80">{a.busy.prep}: {state.prep_minutes} min</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {state.accepting_orders ? (
            <button type="button" className="btn btn-cream" disabled={busy} onClick={() => send({ accepting_orders: false, pause_message_ar: pauseMsg })} data-testid="pause-orders"><Pause className="size-4" /> {a.busy.pause}</button>
          ) : (
            <button type="button" className="btn btn-cream" disabled={busy} onClick={() => send({ accepting_orders: true })} data-testid="resume-orders"><Play className="size-4" /> {a.busy.resume}</button>
          )}
          <button type="button" className={`btn ${state.busy_mode ? 'btn-primary' : 'btn-accent'}`} disabled={busy}
            onClick={() => send({ busy_mode: !state.busy_mode, busy_extra_minutes: Number(extra), busy_message_ar: busyMsg })} data-testid="toggle-busy">
            <Flame className="size-4" /> {a.busy.busyToggle} {state.busy_mode ? '✓' : ''}
          </button>
        </div>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold opacity-90">⚙︎</summary>
        <div className="mt-3 grid gap-3 text-espresso-900 sm:grid-cols-2">
          <label className="text-sm"><span className="mb-1 block font-semibold text-inherit">{a.busy.extra}</span>
            <input type="number" min={0} max={240} className="field" value={extra} onChange={(e) => setExtra(Number(e.target.value))} /></label>
          <label className="text-sm"><span className="mb-1 block font-semibold">{a.busy.maxActive}</span>
            <input type="number" min={0} className="field" placeholder={a.busy.maxHint} value={max} onChange={(e) => setMax(e.target.value === '' ? '' : Number(e.target.value))} /></label>
          <label className="text-sm"><span className="mb-1 block font-semibold">{a.busy.pauseMsg}</span>
            <input className="field" value={pauseMsg} maxLength={200} onChange={(e) => setPauseMsg(e.target.value)} /></label>
          <label className="text-sm"><span className="mb-1 block font-semibold">{a.busy.busyMsg}</span>
            <input className="field" value={busyMsg} maxLength={200} onChange={(e) => setBusyMsg(e.target.value)} /></label>
          <button type="button" className="btn btn-cream sm:col-span-2" disabled={busy}
            onClick={() => send({ busy_extra_minutes: Number(extra), max_active_orders: max === '' ? null : Number(max), pause_message_ar: pauseMsg, busy_message_ar: busyMsg })}>{a.common.save}</button>
        </div>
      </details>
      {msg && <p className="mt-2 text-xs opacity-80" role="status">{msg}</p>}
    </section>
  );
}
