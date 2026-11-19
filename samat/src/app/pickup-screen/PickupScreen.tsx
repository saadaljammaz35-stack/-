'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { browserDb } from '@/lib/supabase/browser';
import { Logo } from '@/components/brand/Logo';
import { chime } from '@/components/admin/OrderAlert';

type Board = { enabled: boolean; ready?: { n: number; at: string }[]; preparing?: number[]; delivered?: number[] };

export function PickupScreen() {
  const [board, setBoard] = useState<Board | null>(null);
  const [clock, setClock] = useState('');
  const prevReady = useRef<Set<number> | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const b = (await (await fetch('/api/pickup-board', { cache: 'no-store' })).json()) as Board;
      const ready = new Set((b.ready ?? []).map((r) => r.n));
      if (prevReady.current) {
        const fresh = [...ready].find((n) => !prevReady.current!.has(n));
        if (fresh !== undefined) { setHighlight(fresh); chime(); setTimeout(() => setHighlight(null), 8000); }
      }
      prevReady.current = ready;
      setBoard(b);
    } catch { /* keep last state */ }
  }, []);

  useEffect(() => {
    load();
    const db = browserDb();
    const ch = db.channel('pickup-screen').on('postgres_changes', { event: '*', schema: 'public', table: 'order_board' }, () => load()).subscribe();
    const poll = setInterval(load, 8000);
    const tick = setInterval(() => setClock(new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' })), 1000);
    return () => { db.removeChannel(ch); clearInterval(poll); clearInterval(tick); };
  }, [load]);

  if (board && !board.enabled) {
    return <div className="grid min-h-dvh place-items-center bg-espresso-950 text-cream-100"><Logo variant="full" height={220} /></div>;
  }
  return (
    <div className="min-h-dvh bg-espresso-950 p-8 text-cream-100" data-testid="pickup-screen">
      <header className="flex items-center justify-between">
        <Logo variant="full" height={110} />
        <p className="num text-6xl font-bold" dir="ltr">{clock}</p>
      </header>
      <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section>
          <h1 className="text-4xl font-bold text-ok-500">جاهز للاستلام · Ready</h1>
          <div className="mt-6 grid grid-cols-3 gap-5 xl:grid-cols-4">
            <AnimatePresence>
              {(board?.ready ?? []).map((r) => (
                <motion.div key={r.n} layout initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: highlight === r.n ? 1.08 : 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  className={`num grid aspect-[4/3] place-items-center rounded-[2rem] text-7xl font-bold ${highlight === r.n ? 'bg-ok-500 text-white animate-pulse-ring' : 'bg-cream-100 text-espresso-900'}`}>
                  {r.n}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
        <aside className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gold-400">تحت التجهيز · Preparing</h2>
            <p className="num mt-3 text-4xl font-bold leading-relaxed text-cream-200/80">{(board?.preparing ?? []).join('  ·  ') || '—'}</p>
          </div>
          <div>
            <h2 className="text-xl font-bold text-cream-200/60">تم التسليم · Collected</h2>
            <p className="num mt-2 text-2xl text-cream-200/40">{(board?.delivered ?? []).join('  ·  ') || '—'}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
