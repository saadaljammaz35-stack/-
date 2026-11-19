'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/browser';

/** Re-renders the server page whenever any order changes (PII-free realtime board) + slow polling. */
export function LiveRefresh({ onEvent, everyMs = 30000 }: { onEvent?: (payload: { eventType: string; new: Record<string, unknown> }) => void; everyMs?: number }) {
  const router = useRouter();
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    const db = browserDb();
    let t: ReturnType<typeof setTimeout> | undefined;
    const ch = db.channel(`admin-board-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_board' }, (p) => {
        cb.current?.(p as unknown as { eventType: string; new: Record<string, unknown> });
        clearTimeout(t);
        t = setTimeout(() => router.refresh(), 250);
      })
      .subscribe();
    const poll = setInterval(() => router.refresh(), everyMs);
    return () => { db.removeChannel(ch); clearInterval(poll); clearTimeout(t); };
  }, [router, everyMs]);
  return null;
}
