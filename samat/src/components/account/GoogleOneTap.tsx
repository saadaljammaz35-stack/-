'use client';
import { useEffect } from 'react';
import Script from 'next/script';
import { usePathname, useRouter } from 'next/navigation';

type IdApi = {
  initialize(o: Record<string, unknown>): void;
  prompt(): void;
  cancel(): void;
};
const gid = () => (window as unknown as { google?: { accounts: { id: IdApi } } }).google?.accounts.id;

/**
 * Google One Tap for signed-out customers anywhere in the store: returning customers are signed in
 * automatically (auto_select), new ones get a one-tap prompt. The account page shows its own button.
 */
export function GoogleOneTap({ clientId }: { clientId: string }) {
  const router = useRouter();
  const path = usePathname();
  const skip = path.startsWith('/account');

  const start = () => {
    const id = gid();
    if (!id || skip) return;
    id.initialize({
      client_id: clientId, auto_select: true, cancel_on_tap_outside: true, use_fedcm_for_prompt: true, itp_support: true, context: 'signin',
      callback: async ({ credential }: { credential: string }) => {
        const res = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) });
        if (res.ok) router.refresh();
      },
    });
    id.prompt();
  };

  useEffect(() => {
    if (gid()) start();
    return () => gid()?.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  if (skip) return null;
  return <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" onLoad={start} />;
}
