'use client';
import { useEffect, useState } from 'react';
import { BellRing, BellPlus } from 'lucide-react';
import { useAdmin } from '@/lib/i18n/admin-client';
import { pushSupported, subscribePush } from '@/components/pwa/push-client';

/** Turns on new-order and daily-report notifications on this device (staff). */
export function StaffPushToggle() {
  const { a } = useAdmin();
  const [state, setState] = useState<'hidden' | 'idle' | 'busy' | 'on' | 'denied' | 'error'>('hidden');
  useEffect(() => {
    if (!pushSupported()) return;
    setState(localStorage.getItem('samat_staff_push') === '1' && Notification.permission === 'granted' ? 'on' : 'idle');
  }, []);
  if (state === 'hidden') return null;
  if (state === 'on') return <span className="btn btn-sm btn-ghost text-ok-500"><BellRing className="size-4" /> {a.dash.pushOn}</span>;
  return (
    <button type="button" className="btn btn-sm btn-ghost" disabled={state === 'busy'} title={state === 'denied' ? a.dash.pushDenied : undefined} onClick={async () => {
      setState('busy');
      const r = await subscribePush({ kind: 'staff' });
      if (r === 'ok') { try { localStorage.setItem('samat_staff_push', '1'); } catch { /* ignore */ } }
      setState(r === 'ok' ? 'on' : r);
    }} data-testid="staff-push"><BellPlus className="size-4" /> {state === 'denied' ? a.dash.pushDenied : a.dash.pushAsk}</button>
  );
}
