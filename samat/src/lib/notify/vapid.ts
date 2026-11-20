import 'server-only';
import { createECDH, hkdfSync } from 'node:crypto';
import { env } from '@/lib/env';

export interface VapidKeys { publicKey: string; privateKey: string }
let cached: VapidKeys | null | undefined;

/**
 * Keys for browser notifications. Uses VAPID_PRIVATE_KEY + NEXT_PUBLIC_VAPID_PUBLIC_KEY when both are set;
 * otherwise derives a stable P-256 key pair from the server key (one-way HKDF), so no extra secret is needed.
 * Rotating the server key changes the pair: browsers then subscribe again on their next opt-in.
 */
export function vapidKeys(): VapidKeys | null {
  if (cached !== undefined) return cached;
  if (env.vapidPublic && env.vapidPrivate) return (cached = { publicKey: env.vapidPublic, privateKey: env.vapidPrivate });
  if (!env.supabaseServiceKey) return (cached = null);
  try {
    const priv = Buffer.from(hkdfSync('sha256', env.supabaseServiceKey, 'samat', 'samat-vapid-v1', 32));
    const ecdh = createECDH('prime256v1');
    ecdh.setPrivateKey(priv);
    return (cached = { publicKey: ecdh.getPublicKey().toString('base64url'), privateKey: priv.toString('base64url') });
  } catch {
    return (cached = null);
  }
}
