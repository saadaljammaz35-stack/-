import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "./config";
import { AppError, badRequest, forbidden, reportError } from "./errors";

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store", ...headers } });
}

export function clientIp(req: NextRequest | Request): string | null {
  if (!config().TRUST_PROXY) return null;
  const xff = req.headers.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0] : req.headers.get("x-real-ip"))?.trim();
  if (!ip) return null;
  // Only accept something that looks like an IP so it can go in an inet column.
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}

/**
 * CSRF defence for cookie-authenticated mutations: the request must come from
 * our own origin. Session cookies are also SameSite=Lax.
 */
export function assertSameOrigin(req: NextRequest | Request): void {
  const expected = new URL(config().APP_URL).origin;
  const origin = req.headers.get("origin");
  if (origin) {
    if (origin !== expected) throw forbidden("Cross-origin request refused");
    return;
  }
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw forbidden("Cross-site request refused");
  if (!site && config().NODE_ENV === "production") throw forbidden("Missing origin");
}

export async function readJson<T extends z.ZodType>(req: Request, schema: T, maxBytes = 64 * 1024): Promise<z.infer<T>> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) throw badRequest("payload_too_large", "Request body too large");
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > maxBytes) throw badRequest("payload_too_large", "Request body too large");
    raw = text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw badRequest("invalid_json", "Body must be JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw badRequest(
      "validation_failed",
      "Some fields are invalid",
      parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return parsed.data;
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Wraps a route handler: maps AppError to JSON, records unexpected errors. */
export function route<C>(name: string, handler: Handler<C>, opts: { csrf?: boolean } = {}): Handler<C> {
  return async (req, ctx) => {
    try {
      if (opts.csrf !== false && !["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof AppError) {
        const headers: Record<string, string> = {};
        const d = err.details as { retryAfter?: number } | undefined;
        if (err.status === 429 && d?.retryAfter) headers["retry-after"] = String(d.retryAfter);
        return json({ error: { code: err.code, message: err.message, details: err.details } }, err.status, headers);
      }
      await reportError(`api:${name}`, err, { method: req.method, path: req.nextUrl.pathname });
      return json({ error: { code: "internal", message: "Something went wrong on our side. It has been logged." } }, 500);
    }
  };
}
