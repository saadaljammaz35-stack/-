import type { PostgrestError } from '@supabase/supabase-js';

/** Application error with a stable code that maps to a localized message (dict.errors[code]). */
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public detail: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

/** Turn 'SAMAT:<code>' database errors into AppError; anything else becomes a 500. */
export function fromDbError(err: PostgrestError | Error | null | undefined): AppError {
  if (!err) return new AppError('unknown', 500);
  const msg = 'message' in err ? err.message : String(err);
  const m = /^SAMAT:([a-z_]+)/.exec(msg);
  if (m) {
    let detail: Record<string, unknown> = {};
    const raw = (err as PostgrestError).details;
    if (raw) {
      try { detail = JSON.parse(raw); } catch { /* not json */ }
    }
    const code = m[1];
    const status = code === 'forbidden' ? 403 : code === 'order_not_found' ? 404 : code.startsWith('store_') ? 409 : 400;
    return new AppError(code, status, detail);
  }
  console.error('[db]', msg);
  return new AppError('unknown', 500);
}

export function errorResponse(e: unknown): Response {
  const err = e instanceof AppError ? e : (console.error(e), new AppError('unknown', 500));
  return Response.json({ error: err.code, detail: err.detail }, { status: err.status });
}
