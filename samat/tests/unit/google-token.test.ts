import { generateKeyPairSync, sign } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { _resetGoogleKeyCache, verifyGoogleIdToken } from '@/lib/auth/google-token';

const CLIENT = '123-abc.apps.googleusercontent.com';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Date.now();

function token(claims: Record<string, unknown>, key = privateKey, kid = 'k1') {
  const h = b64({ alg: 'RS256', kid, typ: 'JWT' });
  const p = b64({ iss: 'https://accounts.google.com', aud: CLIENT, sub: '1100', email: 'Customer@Gmail.com', email_verified: true,
    name: 'عميل', iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 3600, ...claims });
  return `${h}.${p}.${sign('RSA-SHA256', Buffer.from(`${h}.${p}`), key).toString('base64url')}`;
}
const jwks = (async () => new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'cache-control': 'max-age=600' } })) as unknown as typeof fetch;

describe('Google ID token verification', () => {
  beforeEach(() => _resetGoogleKeyCache());
  it('accepts a valid token and returns the account', async () => {
    expect(await verifyGoogleIdToken(token({}), CLIENT, jwks, now)).toEqual({ sub: '1100', email: 'customer@gmail.com', name: 'عميل' });
  });
  it('rejects another app (audience)', async () => {
    await expect(verifyGoogleIdToken(token({ aud: 'someone-else' }), CLIENT, jwks, now)).rejects.toThrow('bad audience');
  });
  it('rejects a forged signature', async () => {
    await expect(verifyGoogleIdToken(token({}, other.privateKey), CLIENT, jwks, now)).rejects.toThrow('bad signature');
  });
  it('rejects an expired token', async () => {
    await expect(verifyGoogleIdToken(token({ exp: Math.floor(now / 1000) - 3600 }), CLIENT, jwks, now)).rejects.toThrow('expired');
  });
  it('rejects a wrong issuer and an unverified e-mail', async () => {
    await expect(verifyGoogleIdToken(token({ iss: 'https://evil.example' }), CLIENT, jwks, now)).rejects.toThrow('bad issuer');
    await expect(verifyGoogleIdToken(token({ email_verified: false }), CLIENT, jwks, now)).rejects.toThrow('unverified');
  });
  it('rejects an unknown key id', async () => {
    await expect(verifyGoogleIdToken(token({}, privateKey, 'nope'), CLIENT, jwks, now)).rejects.toThrow('unknown key');
  });
});
