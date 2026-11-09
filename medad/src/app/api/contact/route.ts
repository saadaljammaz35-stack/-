import { validateContact, type ContactPayload, type ContactResponse } from '@/lib/contact';

/**
 * POST /api/contact
 *
 * Delivers project enquiries through whichever channel is configured:
 *   A. CONTACT_WEBHOOK_URL               → JSON POST to any webhook
 *   B. RESEND_API_KEY + CONTACT_TO_EMAIL → email through Resend
 *
 * The response is `{ ok: true }` only after the channel accepted the message.
 * With nothing configured it answers 503 `not_configured`, so the form can
 * tell the visitor the truth instead of pretending the message was sent.
 */

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 16 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;

// Best-effort, per-instance limiter. Serverless instances do not share it, so
// it only slows down bursts; put a WAF or a shared store in front for more.
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(k);
  }
  return recent.length > RATE_MAX;
}

function json(body: ContactResponse, status: number) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type Delivery = (payload: ContactPayload & { locale: string }) => Promise<boolean>;

function configuredDelivery(): Delivery | null {
  const webhook = process.env.CONTACT_WEBHOOK_URL?.trim();
  if (webhook) {
    return async (payload) => {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          source: 'medad-website',
          submittedAt: new Date().toISOString(),
          ...payload,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = process.env.CONTACT_TO_EMAIL?.trim();
  if (apiKey && to) {
    const from = process.env.CONTACT_FROM_EMAIL?.trim() || 'MEDAD Website <onboarding@resend.dev>';
    return async (payload) => {
      const rows: [string, string][] = [
        ['Name', payload.name],
        ['Email', payload.email],
        ['Project type', payload.projectType],
        ['Budget', payload.budget],
        ['Language', payload.locale],
      ];
      const text = `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${payload.details}`;
      const html = `<table cellpadding="6">${rows
        .map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${escapeHtml(v)}</td></tr>`)
        .join('')}</table><p style="white-space:pre-wrap">${escapeHtml(payload.details)}</p>`;
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: to.split(',').map((s) => s.trim()),
          reply_to: payload.email,
          subject: `New project enquiry — ${payload.name}`,
          text,
          html,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    };
  }

  return null;
}

export async function POST(request: Request) {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) return json({ ok: false, error: 'bad_request' }, 413);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: 'bad_request' }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  // Honeypot: a field real visitors never see. Rejected, never reported as sent.
  if (typeof body.website === 'string' && body.website.length > 0) {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  const result = validateContact(body);
  if (!result.ok) return json({ ok: false, error: 'invalid', fields: result.errors }, 422);

  const deliver = configuredDelivery();
  if (!deliver) return json({ ok: false, error: 'not_configured' }, 503);

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (rateLimited(ip)) return json({ ok: false, error: 'rate_limited' }, 429);

  const locale = body.locale === 'en' ? 'en' : 'ar';
  try {
    const delivered = await deliver({ ...result.data, locale });
    if (!delivered) return json({ ok: false, error: 'delivery_failed' }, 502);
  } catch {
    return json({ ok: false, error: 'delivery_failed' }, 502);
  }

  return json({ ok: true }, 200);
}
