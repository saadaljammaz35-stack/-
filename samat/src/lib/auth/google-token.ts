import { createPublicKey, verify as verifySig, type JsonWebKeyInput } from 'node:crypto';

type JsonWebKey = JsonWebKeyInput['key'];

/**
 * Verifies a Google Sign-In ID token (RS256 JWT) without third-party libraries:
 * signature against Google's published keys, issuer, audience (our client ID), expiry and a
 * verified e-mail. Returns the Google account details.
 */
export interface GoogleIdentity { sub: string; email: string; name: string | null }

const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
/** Local tests may point at their own key server; production always uses Google's keys. */
const jwksUrl = () => (process.env.NODE_ENV !== 'production' && process.env.GOOGLE_JWKS_URL) || GOOGLE_JWKS;
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
let cache: { keys: (JsonWebKey & { kid?: string })[]; until: number } | null = null;

async function googleKeys(fetcher: typeof fetch, force = false) {
  if (!force && cache && cache.until > Date.now()) return cache.keys;
  const res = await fetcher(jwksUrl(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`google keys ${res.status}`);
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  const { keys } = (await res.json()) as { keys: (JsonWebKey & { kid?: string })[] };
  cache = { keys, until: Date.now() + Math.min(maxAge, 86_400) * 1000 };
  return keys;
}

const part = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

export async function verifyGoogleIdToken(token: string, clientId: string, fetcher: typeof fetch = fetch, now = Date.now()): Promise<GoogleIdentity> {
  const pieces = token.split('.');
  if (pieces.length !== 3) throw new Error('malformed');
  const [h, p, s] = pieces;
  const header = part(h) as { alg?: string; kid?: string };
  if (header.alg !== 'RS256' || !header.kid) throw new Error('unexpected header');
  let jwk = (await googleKeys(fetcher)).find((k) => k.kid === header.kid);
  if (!jwk) jwk = (await googleKeys(fetcher, true)).find((k) => k.kid === header.kid); // keys rotate
  if (!jwk) throw new Error('unknown key');
  const ok = verifySig('RSA-SHA256', Buffer.from(`${h}.${p}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'));
  if (!ok) throw new Error('bad signature');
  const c = part(p) as { iss?: string; aud?: string; exp?: number; iat?: number; sub?: string; email?: string; email_verified?: boolean | string; name?: string };
  if (!c.iss || !ISSUERS.has(c.iss)) throw new Error('bad issuer');
  if (c.aud !== clientId) throw new Error('bad audience');
  if (!c.exp || c.exp * 1000 < now - 60_000) throw new Error('expired');
  if (c.iat && c.iat * 1000 > now + 300_000) throw new Error('issued in the future');
  if (!c.sub || !c.email || !(c.email_verified === true || c.email_verified === 'true')) throw new Error('unverified e-mail');
  return { sub: c.sub, email: c.email.toLowerCase(), name: c.name ?? null };
}

/** Test hook: forget cached keys. */
export function _resetGoogleKeyCache() { cache = null; }
