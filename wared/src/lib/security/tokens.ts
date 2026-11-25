import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { requireAppSecret } from '@/lib/server-env';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmac(value: string): string {
  return createHmac('sha256', requireAppSecret()).update(value).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Random URL-safe token (for newsletter confirm/unsubscribe links). Store only sha256(token). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Keyed hash of an IP address. Raw IPs are never stored. */
export function hashIp(ip: string): string {
  return hmac(`ip:${ip}`).slice(0, 32);
}

/**
 * Signed "form issued at" token. A submission is rejected when the token is forged, older than a day,
 * or younger than two seconds (bots usually post instantly).
 */
export function issueFormToken(form: string, now = Date.now()): string {
  const issued = String(now);
  return `${issued}.${hmac(`form:${form}:${issued}`)}`;
}

export function verifyFormToken(form: string, token: string | null | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [issued, signature] = token.split('.');
  if (!issued || !signature || !/^\d{13}$/.test(issued)) return false;
  if (!safeEqual(signature, hmac(`form:${form}:${issued}`))) return false;
  const age = now - Number(issued);
  return age >= 2_000 && age <= 24 * 60 * 60 * 1000;
}
