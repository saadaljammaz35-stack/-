// HTTP plumbing shared by every function: CORS, JSON bodies with a size cap,
// request validation, and one error format:
//
//   { "error": "<machine_code>", "message": "<human text>", "request_id": "…" }
//
// Error codes are stable and the frontend maps them to Arabic/English copy.

import { z } from "./deps.ts";
import { ConfigError, optionalEnv } from "./env.ts";
import { log } from "./log.ts";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? code);
    this.name = "HttpError";
  }
}

const DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173"];

export function allowedOrigins(): string[] {
  const configured = (optionalEnv("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : DEV_ORIGINS;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = allowedOrigins();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

const SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

export function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...SECURITY_HEADERS, ...corsHeaders(req) },
  });
}

export async function readText(req: Request, maxBytes: number): Promise<string> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new HttpError(413, "payload_too_large");
  const buffer = new Uint8Array(await req.arrayBuffer());
  if (buffer.byteLength > maxBytes) throw new HttpError(413, "payload_too_large");
  return new TextDecoder().decode(buffer);
}

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const text = await readText(req, maxBytes);
  if (text.trim() === "") throw new HttpError(400, "invalid_json", "Request body is empty");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "Request body is not valid JSON");
  }
}

export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(
      400,
      "invalid_request",
      "Some fields are missing or invalid",
      result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }
  return result.data;
}

export interface RequestContext {
  requestId: string;
}

export type Handler = (req: Request, ctx: RequestContext) => Promise<Response>;

export interface ServeOptions {
  /** Methods the function accepts besides OPTIONS. Defaults to POST only. */
  methods?: string[];
}

/** Wraps a handler with CORS preflight, method checks and uniform error responses. */
export function handle(name: string, handler: Handler, options: ServeOptions = {}) {
  const methods = options.methods ?? ["POST"];
  return async (req: Request): Promise<Response> => {
    const ctx: RequestContext = { requestId: crypto.randomUUID() };
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }
    if (!methods.includes(req.method)) {
      return json(
        req,
        { error: "method_not_allowed", message: `Use ${methods.join(" or ")}`, request_id: ctx.requestId },
        405,
      );
    }
    const started = Date.now();
    try {
      const response = await handler(req, ctx);
      log.info(`${name}.done`, { request_id: ctx.requestId, status: response.status, ms: Date.now() - started });
      return response;
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status >= 500) {
          log.error(`${name}.failed`, { request_id: ctx.requestId, code: error.code, error });
        } else {
          log.info(`${name}.rejected`, { request_id: ctx.requestId, status: error.status, code: error.code });
        }
        return json(
          req,
          { error: error.code, message: error.message, details: error.details, request_id: ctx.requestId },
          error.status,
        );
      }
      if (error instanceof ConfigError) {
        log.error(`${name}.not_configured`, { request_id: ctx.requestId, variable: error.variable });
        return json(
          req,
          {
            error: "not_configured",
            message: `Server configuration is missing or invalid: ${error.variable}`,
            details: { variable: error.variable },
            request_id: ctx.requestId,
          },
          503,
        );
      }
      log.error(`${name}.crashed`, { request_id: ctx.requestId, error });
      return json(
        req,
        { error: "internal_error", message: "Something went wrong on our side", request_id: ctx.requestId },
        500,
      );
    }
  };
}

/** Starts a Deno server for an Edge Function entrypoint. */
export function serve(name: string, handler: Handler, options: ServeOptions = {}): void {
  Deno.serve(handle(name, handler, options));
}
