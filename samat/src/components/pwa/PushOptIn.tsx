'use client';
import { useEffect, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { needsInstallForPush, pushSupported, subscribePush } from './push-client';

/** "Notify me when it's ready" on the tracking page. */
export function PushOptIn({ token }: { token: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<'idle' | 'on' | 'denied' | 'error' | 'busy' | 'install' | 'hidden'>('hidden');
  useEffect(() => {
    if (needsInstallForPush()) return setState('install');
    if (!pushSupported()) return;
    setState(localStorage.getItem(`samat_push_${token}`) === '1' ? 'on' : 'idle');
  }, [token]);
  if (state === 'hidden') return null;
  if (state === 'install') return <p className="mt-4 rounded-2xl bg-cream-100/80 p-4 text-sm text-espresso-700">{t.track.pushInstall}</p>;
  return (
    <div className="mt-4 rounded-2xl bg-cream-100/80 p-4" data-testid="push-optin">
      {state === 'on' ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-ok-500"><BellRing className="size-5" /> {t.track.pushOn}</p>
      ) : (
        <button type="button" className="btn btn-primary w-full" disabled={state === 'busy'} onClick={async () => {
          setState('busy');
          const r = await subscribePush({ kind: 'order', token });
          if (r === 'ok') { try { localStorage.setItem(`samat_push_${token}`, '1'); } catch { /* private mode */ } }
          setState(r === 'ok' ? 'on' : r);
        }}><Bell className="size-4" /> {t.track.pushAsk}</button>
      )}
      {state === 'denied' && <p className="mt-2 text-xs text-espresso-600">{t.track.pushDenied}</p>}
      {state === 'error' && <p className="mt-2 text-xs text-danger-500">{t.common.error}</p>}
    </div>
  );
}
