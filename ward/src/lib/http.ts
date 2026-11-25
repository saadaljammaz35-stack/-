import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const unauthorized = () => new HttpError(401, 'unauthorized');
export const forbidden = (code = 'forbidden') => new HttpError(403, code);
export const notFound = (code = 'not_found') => new HttpError(404, code);
export const badRequest = (code: string, message?: string) => new HttpError(400, code, message);
export const conflict = (code: string, message?: string) => new HttpError(409, code, message);

export function isFormPost(req: Request): boolean {
  const ct = req.headers.get('content-type') ?? '';
  return ct.startsWith('application/x-www-form-urlencoded') || ct.startsWith('multipart/form-data');
}

/** Accepts JSON or HTML form posts so every screen works without client JavaScript. */
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const ct = req.headers.get('content-type') ?? '';
  if (ct.startsWith('application/json')) {
    const text = await req.text();
    if (text.length > 1_000_000) throw badRequest('body_too_large');
    if (!text) return {};
    try {
      const value: unknown = JSON.parse(text);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw badRequest('invalid_json');
      return value as Record<string, unknown>;
    } catch {
      throw badRequest('invalid_json');
    }
  }
  if (isFormPost(req)) {
    const form = await req.formData();
    const out: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (key.endsWith('[]')) {
        const k = key.slice(0, -2);
        out[k] = [...((out[k] as unknown[]) ?? []), value];
      } else out[key] = value;
    }
    return out;
  }
  return {};
}

export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown').trim();
}

/**
 * CSRF defence for state-changing requests (in addition to SameSite=Strict cookies):
 * the Origin (or Referer) must match the host that served the request.
 */
export function assertSameOrigin(req: Request): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const source = req.headers.get('origin') ?? req.headers.get('referer');
  if (!host || !source) throw forbidden('origin_required');
  let sourceHost: string;
  try {
    sourceHost = new URL(source).host;
  } catch {
    throw forbidden('bad_origin');
  }
  if (sourceHost !== host) throw forbidden('cross_origin');
}

function safeRedirectTarget(req: Request, fallback: string): string {
  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      if (url.host === (req.headers.get('x-forwarded-host') ?? req.headers.get('host'))) return url.pathname + url.search;
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

export function respond(req: Request, data: unknown, opts: { redirect?: string; status?: number } = {}): Response {
  if (isFormPost(req)) {
    const target = opts.redirect ?? safeRedirectTarget(req, '/os');
    return new NextResponse(null, { status: 303, headers: { Location: target } });
  }
  return NextResponse.json(data ?? { ok: true }, { status: opts.status ?? 200 });
}

export function errorResponse(req: Request, err: unknown): Response {
  let status = 500;
  let code = 'internal_error';
  let message: string | undefined;
  if (err instanceof HttpError) {
    status = err.status;
    code = err.code;
    message = err.message !== err.code ? err.message : undefined;
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'validation_failed';
    message = err.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
  } else {
    console.error('[ward] unhandled error', err);
  }
  if (isFormPost(req) && status !== 401) {
    const base = safeRedirectTarget(req, '/os');
    const sep = base.includes('?') ? '&' : '?';
    return new NextResponse(null, { status: 303, headers: { Location: `${base}${sep}error=${encodeURIComponent(code)}` } });
  }
  if (isFormPost(req) && status === 401) {
    return new NextResponse(null, { status: 303, headers: { Location: '/os/login' } });
  }
  return NextResponse.json({ error: code, message }, { status });
}

export type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wrap a route handler so that every thrown error becomes a consistent response. */
export function route<C = { params: Promise<Record<string, string>> }>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(req, err);
    }
  };
}
