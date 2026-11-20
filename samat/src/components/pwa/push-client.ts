'use client';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export const pushSupported = () =>
  typeof window !== 'undefined' && Boolean(PUBLIC_KEY) && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** iPhone/iPad only allow notifications once the site is installed on the home screen. */
export const needsInstallForPush = () =>
  typeof window !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches;

function keyBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Asks permission, subscribes this browser and registers it with our server. */
export async function subscribePush(body: { kind: 'order'; token: string } | { kind: 'staff' }): Promise<'ok' | 'denied' | 'error'> {
  try {
    if (!pushSupported()) return 'error';
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
    const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, subscription: sub.toJSON() }) });
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}
