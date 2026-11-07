import { createHash } from "node:crypto";
import { query } from "./db";

/** An error whose message is safe to show the client. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, msg: string, details?: unknown) => new AppError(400, code, msg, details);
export const unauthorized = (msg = "Sign in required") => new AppError(401, "unauthorized", msg);
export const forbidden = (msg = "Not allowed") => new AppError(403, "forbidden", msg);
// Used for "not yours" too, so other customers' ids cannot be probed.
export const notFound = (msg = "Not found") => new AppError(404, "not_found", msg);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);
export const tooMany = (retryAfter: number) => new AppError(429, "rate_limited", `Too many requests. Try again in ${retryAfter}s.`, { retryAfter });
export const unavailable = (code: string, msg: string) => new AppError(503, code, msg);

const SECRET_ENV = ["ANTHROPIC_API_KEY", "RESEND_API_KEY", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "CRON_SECRET", "ENCRYPTION_KEY", "DATABASE_URL"];

/**
 * Removes credentials from text before it is logged or stored. Error
 * messages can quote a header value verbatim (a malformed API key once
 * ended up in a stored analysis error this way), so every log line and
 * every stored error message goes through this.
 */
export function redactSecrets(text: string): string {
  let out = text;
  for (const name of SECRET_ENV) {
    const value = process.env[name];
    if (!value) continue;
    // The whole value, and each long piece of it in case a message quotes
    // only part of a value that contains spaces or quotes.
    for (const piece of [value, ...value.split(/[\s"'\\]+/)]) {
      if (piece.length >= 12) out = out.split(piece).join(`[${name}]`);
    }
  }
  return out
    .replace(/sk-ant-[A-Za-z0-9_-]{6,}/g, "sk-ant-[redacted]")
    .replace(/(postgres(?:ql)?:\/\/[^:/\s@]+:)[^@\s]+@/g, "$1[redacted]@");
}

export function log(level: "info" | "warn" | "error", msg: string, fields: Record<string, unknown> = {}): void {
  const line = redactSecrets(JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields }));
  if (level === "error") console.error(line);
  else console.log(line);
}

/**
 * Records an unexpected error in error_events (grouped by fingerprint) so the
 * owner can see and resolve it in the admin console, and logs it as JSON for
 * the hosting provider's log drain. Never throws.
 */
export async function reportError(source: string, err: unknown, context: Record<string, unknown> = {}): Promise<void> {
  const e = err instanceof Error ? err : new Error(String(err));
  const firstFrame = (e.stack ?? "").split("\n").slice(1, 3).join("|").replace(/:\d+:\d+/g, "");
  const fingerprint = createHash("sha256").update(`${source}|${e.name}|${e.message.replace(/[0-9a-f-]{36}/gi, "<id>")}|${firstFrame}`).digest("hex");
  log("error", e.message, { source, stack: e.stack, ...context });
  try {
    await query(
      `INSERT INTO error_events (fingerprint, source, message, stack, context)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (fingerprint) DO UPDATE
         SET occurrences = error_events.occurrences + 1, last_seen = now(), context = EXCLUDED.context,
             resolved_at = NULL, resolved_by = NULL`,
      [fingerprint, source, redactSecrets(e.message).slice(0, 2000), redactSecrets(e.stack ?? "").slice(0, 8000), redactSecrets(JSON.stringify(context))],
    );
  } catch (dbErr) {
    log("error", "failed to persist error event", { err: String(dbErr) });
  }
}
