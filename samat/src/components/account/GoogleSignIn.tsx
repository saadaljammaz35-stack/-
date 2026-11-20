'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/client';

interface GoogleId {
  initialize(o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup'; use_fedcm_for_button?: boolean; context?: string }): void;
  renderButton(el: HTMLElement, o: Record<string, unknown>): void;
}
declare global { interface Window { google?: { accounts: { id: GoogleId } } } }

/** "Continue with Google" for customers (Google Identity Services). The token is checked on our server. */
export function GoogleSignIn({ clientId, next }: { clientId: string; next: string }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const render = useCallback(() => {
    const id = window.google?.accounts.id;
    if (!id || !box.current) return;
    id.initialize({
      client_id: clientId, ux_mode: 'popup', use_fedcm_for_button: true, context: 'signin',
      callback: async ({ credential }) => {
        setBusy(true); setError(null);
        const res = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          setBusy(false);
          return setError(t.errors[json.error as keyof typeof t.errors] ?? t.common.error);
        }
        router.replace(next);
        router.refresh();
      },
    });
    box.current.innerHTML = '';
    id.renderButton(box.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale, width: 300, logo_alignment: 'center' });
  }, [clientId, locale, next, router, t]);

  useEffect(() => { if (window.google?.accounts?.id) render(); }, [render]);

  return (
    <div data-testid="google-signin">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={render} />
      <div ref={box} className={`flex min-h-11 justify-center ${busy ? 'pointer-events-none opacity-50' : ''}`} />
      {error && <p role="alert" className="mt-3 rounded-xl bg-danger-500/10 p-3 text-sm text-danger-500">{error}</p>}
    </div>
  );
}
