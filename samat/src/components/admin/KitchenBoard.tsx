'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ChefHat, Maximize, PackageCheck, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { useAdmin } from '@/lib/i18n/admin-client';
import { useI18n } from '@/lib/i18n/client';
import { browserDb } from '@/lib/supabase/browser';
import { chime, useSoundPref } from './OrderAlert';
import { Logo } from '@/components/brand/Logo';

interface KOrder {
  id: string; order_number: number; pickup_code: string; status: 'accepted' | 'preparing' | 'ready' | 'delivered';
  customer_name: string; notes: string | null; accepted_at: string; ready_at: string | null; estimated_ready_at: string | null;
  payment_status: string; late_after_minutes: number;
  items: { id: string; name_ar: string; name_en: string; quantity: number; bread_ar: string | null; bread_en: string | null; notes: string | null;
    customizations: { kind: string; action: string; quantity: number; name_ar: string; name_en: string }[] }[];
}

function elapsed(fromIso: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  return { m: Math.floor(s / 60), label: `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` };
}

export function KitchenBoard({ canUpdate, canDeliver }: { canUpdate: boolean; canDeliver: boolean }) {
  const { a } = useAdmin();
  const { locale, setLocale } = useI18n();
  const [orders, setOrders] = useState<KOrder[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useSoundPref('samat_kds_sound');
  const [flash, setFlash] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const known = useRef<Set<string> | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/kitchen/orders', { cache: 'no-store' });
      if (res.status === 401) { window.location.href = '/admin/login?next=/kitchen'; return; }
      if (!res.ok) throw new Error();
      const list = (await res.json()) as KOrder[];
      setOnline(true);
      const ids = new Set(list.filter((o) => o.status === 'accepted').map((o) => o.id));
      if (known.current) {
        const fresh = list.filter((o) => o.status === 'accepted' && !known.current!.has(o.id));
        if (fresh.length) {
          setFlash(fresh[0].order_number);
          if (soundRef.current) chime();
          setTimeout(() => setFlash(null), 5000);
        }
      }
      known.current = new Set([...(known.current ?? []), ...ids]);
      setOrders(list);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    load();
    const db = browserDb();
    const ch = db.channel('kds').on('postgres_changes', { event: '*', schema: 'public', table: 'order_board' }, () => load()).subscribe();
    const poll = setInterval(load, 10000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { db.removeChannel(ch); clearInterval(poll); clearInterval(tick); };
  }, [load]);

  const act = async (id: string, action: 'preparing' | 'ready' | 'delivered') => {
    setBusy(id);
    await fetch(`/api/admin/orders/${id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    setBusy(null);
    load();
  };

  const n = (r: { name_ar: string; name_en: string }) => (locale === 'ar' ? r.name_ar : r.name_en);
  const cols: { key: KOrder['status']; title: string; tone: string }[] = [
    { key: 'accepted', title: a.kitchen.accepted, tone: 'border-gold-400' },
    { key: 'preparing', title: a.kitchen.preparing, tone: 'border-terracotta-500' },
    { key: 'ready', title: a.kitchen.ready, tone: 'border-ok-500' },
  ];

  return (
    <div className="min-h-dvh bg-espresso-950 text-cream-100" data-testid="kds">
      <header className="flex flex-wrap items-center gap-3 border-b border-cream-100/10 px-4 py-3">
        <Link href="/admin" className="flex items-center gap-2"><Logo variant="icon" height={30} /><span className="text-lg font-bold">{a.kitchen.title}</span></Link>
        <span className={`chip ${online ? 'bg-ok-500/20 text-ok-500' : 'bg-danger-500/20 text-danger-500'}`}><span className={`size-2 rounded-full ${online ? 'bg-ok-500 animate-pulse' : 'bg-danger-500'}`} />{online ? 'LIVE' : 'OFFLINE'}</span>
        <span className="num ms-auto text-2xl font-bold" dir="ltr">{new Date(now).toLocaleTimeString('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' })}</span>
        <button type="button" className="btn btn-sm border border-cream-100/20" onClick={() => { setSound(!sound); if (!sound) chime(); }} data-testid="kds-sound">
          {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />} {a.kitchen.sound}
        </button>
        <button type="button" className="btn btn-sm border border-cream-100/20" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>{locale === 'ar' ? 'EN' : 'ع'}</button>
        <button type="button" className="btn btn-sm border border-cream-100/20" aria-label="fullscreen" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize className="size-4" /></button>
      </header>

      <AnimatePresence>
        {flash !== null && (
          <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert"
            className="fixed inset-x-0 top-16 z-50 mx-auto w-fit rounded-3xl bg-terracotta-500 px-8 py-4 text-3xl font-bold shadow-lift">
            🔔 {a.kitchen.newOrder} <span className="num">#{flash}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4 p-4 lg:grid-cols-3">
        {cols.map((c) => {
          const list = orders.filter((o) => o.status === c.key).sort((x, y) => x.accepted_at.localeCompare(y.accepted_at));
          return (
            <section key={c.key} aria-label={c.title}>
              <h2 className="mb-3 flex items-center justify-between text-lg font-bold">{c.title} <span className="num chip bg-cream-100/10">{list.length}</span></h2>
              <div className="space-y-3">
                {list.length === 0 && <p className="rounded-3xl border border-dashed border-cream-100/15 p-6 text-center text-sm text-cream-200/50">{a.kitchen.empty}</p>}
                <AnimatePresence initial={false}>
                  {list.map((o) => {
                    const e = elapsed(o.accepted_at, now);
                    const late = o.status !== 'ready' && e.m >= o.late_after_minutes;
                    return (
                      <motion.article key={o.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 60 }}
                        className={`rounded-3xl border-t-4 bg-espresso-900 p-4 shadow-lift ${c.tone} ${late ? 'ring-2 ring-danger-500' : ''}`} data-testid={`kds-${o.order_number}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="num text-4xl font-bold leading-none">#{o.order_number}</p>
                            <p className="mt-1 text-sm text-cream-200/70">{o.customer_name} · <span className="num" dir="ltr">{o.pickup_code}</span></p>
                          </div>
                          <div className={`text-end ${late ? 'text-danger-500' : ''}`}>
                            <p className="num text-2xl font-bold" dir="ltr" data-testid="kds-timer">{e.label}</p>
                            <p className="text-xs opacity-70">{late ? <span className="inline-flex items-center gap-1 font-bold"><AlertTriangle className="size-3" /> {a.kitchen.late}</span> : a.kitchen.since}</p>
                          </div>
                        </div>
                        <ul className="mt-3 space-y-2">
                          {o.items.map((i) => (
                            <li key={i.id} className="rounded-2xl bg-cream-100/5 p-2.5">
                              <p className="text-lg font-bold"><span className="num text-gold-400">{i.quantity}×</span> {n(i)}</p>
                              {(i.bread_ar || i.bread_en) && <p className="text-sm"><span className="text-cream-200/60">{a.kitchen.bread}:</span> <strong>{locale === 'ar' ? i.bread_ar : i.bread_en}</strong></p>}
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {i.customizations.filter((x) => x.kind !== 'bread' && x.action !== 'included').map((x, k) => (
                                  <span key={k} className={`rounded-lg px-2 py-0.5 text-sm font-bold ${x.action === 'removed' ? 'bg-danger-500 text-white' : x.action === 'selected' ? 'bg-cream-100/15' : 'bg-ok-500 text-white'}`}>
                                    {x.action === 'removed' ? (locale === 'ar' ? 'بدون ' : 'NO ') : x.action === 'selected' ? '' : '+ '}{n(x)}{x.quantity > 1 && x.action !== 'removed' ? ` ×${x.quantity}` : ''}
                                  </span>
                                ))}
                              </div>
                              {i.notes && <p className="mt-1 rounded-lg bg-warn-500/20 px-2 py-1 text-sm">📝 {i.notes}</p>}
                            </li>
                          ))}
                        </ul>
                        {o.notes && <p className="mt-2 rounded-xl bg-warn-500/20 px-3 py-2 text-sm">📝 {o.notes}</p>}
                        <div className="mt-3 grid gap-2">
                          {o.status === 'accepted' && canUpdate && <button type="button" disabled={busy === o.id} onClick={() => act(o.id, 'preparing')} className="btn btn-lg btn-accent text-lg" data-testid="kds-start"><ChefHat className="size-5" /> {a.kitchen.start}</button>}
                          {(o.status === 'accepted' || o.status === 'preparing') && canUpdate && <button type="button" disabled={busy === o.id} onClick={() => act(o.id, 'ready')} className={`btn btn-lg text-lg ${o.status === 'preparing' ? 'btn-cream' : 'border border-cream-100/20'}`} data-testid="kds-ready"><Sparkles className="size-5" /> {a.kitchen.ready_btn}</button>}
                          {o.status === 'ready' && canDeliver && <button type="button" disabled={busy === o.id} onClick={() => act(o.id, 'delivered')} className="btn btn-lg btn-cream text-lg" data-testid="kds-delivered"><PackageCheck className="size-5" /> {a.kitchen.delivered_btn}</button>}
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
