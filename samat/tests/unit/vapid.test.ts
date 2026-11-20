import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createECDH, randomBytes } from 'node:crypto';
import webpush from 'web-push';

const fakeEnv: Record<string, string | undefined> = {};
vi.mock('@/lib/env', () => ({ env: new Proxy({}, { get: (_t, k: string) => fakeEnv[k] }) }));

async function load() {
  vi.resetModules();
  return (await import('@/lib/notify/vapid')).vapidKeys();
}

describe('browser notification keys', () => {
  beforeEach(() => { for (const k of Object.keys(fakeEnv)) delete fakeEnv[k]; });

  it('are derived from the server key: stable, valid P-256 and accepted by web-push', async () => {
    fakeEnv.supabaseServiceKey = 'server-key-one';
    const a = await load();
    const b = await load();
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
    expect(Buffer.from(a!.publicKey, 'base64url')).toHaveLength(65);
    expect(Buffer.from(a!.privateKey, 'base64url')).toHaveLength(32);
    expect(() => webpush.setVapidDetails('https://example.com', a!.publicKey, a!.privateKey)).not.toThrow();
    fakeEnv.supabaseServiceKey = 'server-key-two';
    expect((await load())!.publicKey).not.toBe(a!.publicKey);
  });

  it('sign and encrypt a real notification request for a browser subscription', async () => {
    fakeEnv.supabaseServiceKey = 'server-key-one';
    const k = (await load())!;
    const browser = createECDH('prime256v1'); browser.generateKeys();
    const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: browser.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } };
    const req = webpush.generateRequestDetails(sub, JSON.stringify({ title: 'جاهز', body: 'طلبك جاهز', url: '/t/x' }), {
      vapidDetails: { subject: 'https://samat-nine.vercel.app', publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 60,
    });
    expect(req.method).toBe('POST');
    expect(req.endpoint).toBe(sub.endpoint);
    expect(req.headers['Content-Encoding']).toBe('aes128gcm');
    expect(String(req.headers.Authorization)).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${k.publicKey}$`));
    expect((req.body as Buffer).length).toBeGreaterThan(100);
  });

  it('prefer explicitly configured keys, and are off without any key', async () => {
    fakeEnv.vapidPublic = 'pub'; fakeEnv.vapidPrivate = 'priv'; fakeEnv.supabaseServiceKey = 'x';
    expect(await load()).toEqual({ publicKey: 'pub', privateKey: 'priv' });
    delete fakeEnv.vapidPublic; delete fakeEnv.vapidPrivate; delete fakeEnv.supabaseServiceKey;
    expect(await load()).toBeNull();
  });
});
