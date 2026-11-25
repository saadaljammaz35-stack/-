import 'server-only';
import { headers } from 'next/headers';
import { hashIp } from './tokens';

export type Device = 'mobile' | 'tablet' | 'desktop' | 'other';

export function deviceFromUserAgent(ua: string | null): Device {
  if (!ua) return 'other';
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android/i.test(ua)) return 'mobile';
  if (/bot|crawl|spider|preview|curl|wget/i.test(ua)) return 'other';
  return 'desktop';
}

export function clientIpFrom(h: Headers): string {
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? '0.0.0.0';
}

export async function getRequestMeta() {
  const h = await headers();
  const ip = clientIpFrom(h);
  const country = h.get('x-vercel-ip-country');
  return {
    ipHash: hashIp(ip),
    country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    device: deviceFromUserAgent(h.get('user-agent')),
    /** Global Privacy Control or Do Not Track: we then drop the anonymous listener id from analytics. */
    optOut: h.get('sec-gpc') === '1' || h.get('dnt') === '1',
    origin: h.get('origin'),
    host: h.get('host'),
  };
}
