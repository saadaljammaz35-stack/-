import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hasScope, resolveAuth, type ApiScope, type AuthContext } from "@/lib/auth/session";
import { log } from "@/lib/log";
import { AppError, errorBody, toAppError } from "./errors";
import { enforceRateLimit, type RateLimitRule } from "./rate-limit";

export interface RouteContext<B, Auth extends AuthContext | null> {
  req: Request;
  requestId: string;
  auth: Auth;
  body: B;
  params: Record<string, string>;
  ip: string | null;
  url: URL;
}

interface BaseOptions<S extends z.ZodType | undefined> {
  /** Required scope when the caller uses an API key. Session callers have all scopes. */
  scope?: ApiScope;
  /** Reject API keys entirely (account, key management, deploy). */
  sessionOnly?: boolean;
  rateLimit?: RateLimitRule & { by?: "user" | "ip" };
  body?: S;
  maxBodyBytes?: number;
}

type Handler<S extends z.ZodType | undefined, Auth extends AuthContext | null> = (
  c: RouteContext<S extends z.ZodType ? z.infer<S> : undefined, Auth>,
) => Promise<Response | object | null>;

type NextCtx = { params?: Promise<Record<string, string | string[]>> };

export function clientIp(req: Request): string | null {
  if (process.env.OMNIX_TRUST_PROXY !== "true") return null;
  const xff = req.headers.get("x-forwarded-for");
  const ip = xff?.split(",")[0]?.trim();
  return ip && /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : null;
}

/** Cookie-authenticated writes must come from our own origin (CSRF defence in depth on top of SameSite=Lax). */
function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const allowed = process.env.OMNIX_PUBLIC_ORIGIN;
  if (!origin) throw new AppError("FORBIDDEN", "Missing Origin header");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("FORBIDDEN", "Invalid Origin header");
  }
  if (originHost !== host && origin !== allowed) throw new AppError("FORBIDDEN", "Cross-origin request refused");
}

async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) throw new AppError("PAYLOAD_TOO_LARGE", `Body exceeds ${maxBytes} bytes`);
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) throw new AppError("UNSUPPORTED_MEDIA_TYPE", "Expected application/json");
  const buf = await req.arrayBuffer();
  if (buf.byteLength > maxBytes) throw new AppError("PAYLOAD_TOO_LARGE", `Body exceeds ${maxBytes} bytes`);
  if (buf.byteLength === 0) return {};
  try {
    return JSON.parse(new TextDecoder().decode(buf));
  } catch {
    throw new AppError("BAD_REQUEST", "Malformed JSON");
  }
}

function withRequestId(res: Response, requestId: string): Response {
  try {
    res.headers.set("X-Request-Id", requestId);
    return res;
  } catch {
    const headers = new Headers(res.headers);
    headers.set("X-Request-Id", requestId);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(err: unknown, requestId: string): Response {
  const e = toAppError(err);
  if (e.status >= 500) log.error("http.error", { requestId, code: e.code, error: err instanceof Error ? err : String(err) });
  else log.info("http.client_error", { requestId, code: e.code, message: e.message });
  return withRequestId(json(errorBody(e, requestId), { status: e.status, headers: e.headers }), requestId);
}

function build<S extends z.ZodType | undefined, Auth extends AuthContext | null>(
  authMode: "required" | "optional" | "none",
  opts: BaseOptions<S>,
  handler: Handler<S, Auth>,
) {
  return async (req: Request, nextCtx?: NextCtx): Promise<Response> => {
    const requestId = (req.headers.get("x-request-id") ?? "").match(/^[A-Za-z0-9._-]{8,64}$/)?.[0] ?? randomUUID();
    try {
      const url = new URL(req.url);
      const rawParams = (await nextCtx?.params) ?? {};
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawParams)) params[k] = Array.isArray(v) ? v.join("/") : v;
      for (const v of Object.values(params)) {
        if (v.length > 200) throw new AppError("BAD_REQUEST", "Path parameter too long");
      }

      const ip = clientIp(req);
      let auth: AuthContext | null = null;
      if (authMode !== "none") {
        auth = await resolveAuth(req);
        if (!auth && authMode === "required") throw new AppError("UNAUTHENTICATED", "Sign in or provide a valid API key");
        if (auth?.via === "api_key") {
          if (opts.sessionOnly) throw new AppError("FORBIDDEN", "This operation is not available to API keys");
          if (opts.scope && !hasScope(auth, opts.scope)) {
            throw new AppError("FORBIDDEN", `API key lacks the '${opts.scope}' scope`);
          }
        }
        if (auth?.via === "session" && !["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      } else if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        assertSameOrigin(req);
      }

      if (opts.rateLimit) {
        const subject = opts.rateLimit.by === "ip" || !auth ? `ip:${ip ?? "unknown"}` : `user:${auth.userId}`;
        await enforceRateLimit(opts.rateLimit, subject);
      }

      let body: unknown = undefined;
      if (opts.body) {
        const raw = await readJson(req, opts.maxBodyBytes ?? 256 * 1024);
        const parsed = opts.body.safeParse(raw);
        if (!parsed.success) {
          throw new AppError("VALIDATION_FAILED", "Request body is invalid", {
            details: parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message })),
          });
        }
        body = parsed.data;
      }

      const out = await handler({
        req,
        requestId,
        auth: auth as Auth,
        body: body as S extends z.ZodType ? z.infer<S> : undefined,
        params,
        ip,
        url,
      });
      if (out instanceof Response) return withRequestId(out, requestId);
      return withRequestId(json(out ?? { ok: true }), requestId);
    } catch (err) {
      return errorResponse(err, requestId);
    }
  };
}

export const route = {
  /** Authenticated route (session cookie or API key). */
  auth<S extends z.ZodType | undefined = undefined>(opts: BaseOptions<S>, handler: Handler<S, AuthContext>) {
    return build<S, AuthContext>("required", opts, handler);
  },
  /** Public route (register, login, health). */
  public<S extends z.ZodType | undefined = undefined>(opts: BaseOptions<S>, handler: Handler<S, null>) {
    return build<S, null>("none", opts, handler);
  },
};

export const uuidParam = z.string().uuid();

export function parseId(value: string | undefined, what = "Resource"): string {
  const r = uuidParam.safeParse(value);
  if (!r.success) throw new AppError("NOT_FOUND", `${what} not found`);
  return r.data;
}
