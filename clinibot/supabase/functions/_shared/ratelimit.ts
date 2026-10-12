// Rate limiting backed by the consume_rate_limit() database function, so
// limits hold across every Edge Function instance. Keys never contain raw IP
// addresses: client addresses are hashed first.

import type { Db } from "./db.ts";
import { sha256Hex } from "./crypto.ts";
import { optionalEnv } from "./env.ts";
import { HttpError } from "./http.ts";
import { log } from "./log.ts";

export async function rateLimit(db: Db, key: string, limit: number, windowSeconds: number): Promise<void> {
  const { data, error } = await db.rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // Fail closed: if the limiter cannot be checked, the request is refused.
    log.error("ratelimit.error", { key_prefix: key.split(":")[0], code: error.code, detail: error.message });
    throw new HttpError(503, "rate_limit_unavailable", "Please try again shortly");
  }
  if (data !== true) {
    throw new HttpError(429, "rate_limited", "Too many requests. Please wait a moment and try again.", {
      retry_after_seconds: windowSeconds,
    });
  }
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "unknown";
}

/** Salted hash of the caller's IP, safe to store and to use in limiter keys. */
export async function clientIpHash(req: Request): Promise<string> {
  return await sha256Hex(`${optionalEnv("RATE_LIMIT_SALT") ?? "clinibot"}:${clientIp(req)}`);
}
