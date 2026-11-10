import { randomUUID } from "node:crypto";
import pg from "pg";

type Handler = (req: Request, ctx?: { params?: Promise<Record<string, string>> }) => Promise<Response>;

export interface Caller {
  cookie?: string;
  apiKey?: string;
}

/** Invokes a Next.js route handler directly with a real Request, the way the server would. */
export async function call(
  handler: Handler,
  opts: { method?: string; path?: string; body?: unknown; as?: Caller; params?: Record<string, string>; headers?: Record<string, string>; form?: FormData },
): Promise<Response> {
  const headers = new Headers(opts.headers);
  headers.set("host", "localhost");
  if (opts.as?.cookie) headers.set("cookie", opts.as.cookie);
  if (opts.as?.apiKey) headers.set("authorization", `Bearer ${opts.as.apiKey}`);
  const method = opts.method ?? (opts.body || opts.form ? "POST" : "GET");
  if (method !== "GET" && !headers.has("origin")) headers.set("origin", "http://localhost");
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(opts.body);
  }
  const req = new Request(`http://localhost${opts.path ?? "/"}`, { method, headers, body });
  return handler(req, { params: Promise.resolve(opts.params ?? {}) });
}

export async function jsonOf<T = Record<string, unknown>>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function registerUser(register: Handler, name = "Test"): Promise<{ cookie: string; userId: string; workspaceId: string; email: string }> {
  const email = `u-${randomUUID().slice(0, 8)}@example.test`;
  // Each test user comes from its own address so per-IP limits apply per user (OMNIX_TRUST_PROXY=true in tests).
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;
  const res = await call(register, { body: { email, password: "correct-horse-42", displayName: name, locale: "ar" }, headers: { "x-forwarded-for": ip } });
  if (res.status !== 201) throw new Error(`register failed ${res.status} ${await res.text()}`);
  const setCookie = res.headers.get("set-cookie")!;
  const cookie = setCookie.split(";")[0]!;
  const j = await jsonOf<{ userId: string; workspaceId: string }>(res);
  return { cookie, email, ...j };
}

/** Reads an SSE response into a list of events. */
export async function readSse(res: Response): Promise<{ event: string; data: Record<string, unknown> }[]> {
  const text = await res.text();
  return text
    .split("\n\n")
    .map((block) => {
      const ev = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      return ev && data ? { event: ev, data: JSON.parse(data) as Record<string, unknown> } : null;
    })
    .filter((x): x is { event: string; data: Record<string, unknown> } => x !== null);
}

/** Owner connection for assertions that must see past RLS. */
export function ownerPool(): pg.Pool {
  return new pg.Pool({ connectionString: process.env.MIGRATION_DATABASE_URL, max: 2 });
}
