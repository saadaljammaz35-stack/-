'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, PackageCheck, Search, XCircle } from 'lucide-react';
import { useAdmin } from '@/lib/i18n/admin-client';
import { formatMoney } from '@/lib/money';
import { fmtDateTime } from '@/lib/time';

type Lookup = { found: boolean; order_id?: string; order_number?: number; status?: string; customer_name?: string; total?: number;
  payment_status?: string; delivered_at?: string | null; delivered_by_email?: string | null };

export function PickupVerifier() {
  const { a, locale } = useAdmin();
  const [ref, setRef] = useState('');
  const [result, setResult] = useState<Lookup | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<{ stop: () => void; destroy: () => void } | null>(null);

  const lookup = async (value: string) => {
    if (!value.trim()) return;
    setBusy(true); setMsg(null);
    const res = await fetch('/api/admin/pickup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: value, action: 'lookup' }) });
    const json = (await res.json()) as Lookup;
    setBusy(false);
    setResult(res.ok ? json : { found: false });
    if (!res.ok || !json.found) setMsg({ tone: 'bad', text: a.pickup.notFound });
  };

  const deliver = async () => {
    setBusy(true);
    const res = await fetch('/api/admin/pickup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref, action: 'deliver' }) });
    const json = await res.json();
    setBusy(false);
    if (json.ok) {
      setMsg({ tone: 'ok', text: `${a.pickup.done} #${json.order_number}` });
      setResult((r) => (r ? { ...r, status: 'delivered', delivered_at: json.delivered_at } : r));
    } else {
      setMsg({ tone: 'bad', text: json.reason === 'already_delivered' ? `${a.pickup.already} — ${json.delivered_at ? fmtDateTime(json.delivered_at, locale) : ''} ${json.delivered_by_email ?? ''}` : json.reason === 'not_ready' ? a.pickup.notReady : a.pickup.notFound });
    }
  };

  useEffect(() => {
    if (!scanning || !video.current) return;
    let cancelled = false;
    (async () => {
      try {
        const QrScanner = (await import('qr-scanner')).default;
        if (cancelled) return;
        const s = new QrScanner(video.current!, (r) => {
          const value = r.data;
          s.stop();
          setScanning(false);
          setRef(value);
          lookup(value);
        }, { highlightScanRegion: true, highlightCodeOutline: true, preferredCamera: 'environment' });
        scanner.current = s;
        await s.start();
      } catch {
        setScanning(false);
        setMsg({ tone: 'bad', text: a.pickup.cameraError });
      }
    })();
    return () => { cancelled = true; scanner.current?.stop(); scanner.current?.destroy(); scanner.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <form className="glass flex gap-2 rounded-3xl p-3" onSubmit={(e) => { e.preventDefault(); lookup(ref); }}>
        <input className="field num text-center text-2xl uppercase tracking-[0.3em]" dir="ltr" value={ref} onChange={(e) => setRef(e.target.value)}
          placeholder="K7P4QM" autoComplete="off" aria-label={a.pickup.code} data-testid="pickup-input" />
        <button className="btn btn-primary" disabled={busy} data-testid="pickup-lookup"><Search className="size-4" /> {a.pickup.lookup}</button>
      </form>
      <button type="button" className="btn btn-lg btn-ghost w-full" onClick={() => setScanning((s) => !s)}>
        {scanning ? <><CameraOff className="size-5" /> {a.pickup.stopScan}</> : <><Camera className="size-5" /> {a.pickup.scan}</>}
      </button>
      {scanning && <video ref={video} className="aspect-square w-full rounded-3xl bg-black object-cover" muted playsInline />}
      {msg && (
        <p role="alert" className={`flex items-center gap-2 rounded-2xl p-4 text-lg font-bold ${msg.tone === 'ok' ? 'bg-ok-500 text-white' : 'bg-danger-500/10 text-danger-500'}`} data-testid="pickup-msg">
          {msg.tone === 'ok' ? <CheckCircle2 className="size-6" /> : <XCircle className="size-6" />} {msg.text}
        </p>
      )}
      {result?.found && (
        <div className="paper rounded-3xl p-5" data-testid="pickup-result">
          <p className="num text-5xl font-bold">#{result.order_number}</p>
          <p className="mt-1 text-lg">{result.customer_name}</p>
          <p className="num text-sm text-espresso-600">{formatMoney(result.total ?? 0, locale)} · {a.payment[result.payment_status as keyof typeof a.payment]}</p>
          <p className="mt-2 font-semibold">{a.status[result.status as keyof typeof a.status]}</p>
          {result.status === 'delivered' && result.delivered_at && (
            <p className="mt-1 text-sm text-espresso-600">{a.pickup.at}: {fmtDateTime(result.delivered_at, locale)} {result.delivered_by_email ? `· ${a.pickup.by}: ${result.delivered_by_email}` : ''}</p>
          )}
          {result.status === 'ready' && (
            <button type="button" className="btn btn-lg btn-primary mt-4 w-full" disabled={busy} onClick={deliver} data-testid="pickup-deliver"><PackageCheck className="size-5" /> {a.pickup.deliver}</button>
          )}
        </div>
      )}
    </div>
  );
}
