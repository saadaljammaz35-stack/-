import "server-only";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/config/env";
import { withAnon, withUser, type Db } from "@/lib/db/pool";
import { AppError } from "@/lib/http/errors";
import { dummyHash, hashPassword, passwordProblems, verifyPassword } from "./password";
import { isApiKeyShape, newSessionToken, sha256 } from "./tokens";

export const SESSION_COOKIE = "omnix_session";
export const WORKSPACE_COOKIE = "omnix_ws";

export type ApiScope = "chat" | "models:read" | "knowledge:read" | "knowledge:write" | "usage:read";

export interface AuthContext {
  userId: string;
  workspaceId: string;
  via: "session" | "api_key";
  /** Session auth has every scope; API keys have exactly the scopes they were issued. */
  scopes: ReadonlySet<ApiScope> | "all";
  sessionId?: string;
  apiKeyId?: string;
}

/** Auth context plus request metadata carried into audit records. */
export type ReqCtx = AuthContext & { requestId?: string; ip?: string | null };

export function hasScope(ctx: AuthContext, scope: ApiScope): boolean {
  return ctx.scopes === "all" || ctx.scopes.has(scope);
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  locale: "ar" | "en";
}

export async function registerUser(input: RegisterInput): Promise<{ userId: string; workspaceId: string }> {
  const problems = passwordProblems(input.password);
  if (problems.length) throw new AppError("VALIDATION_FAILED", `Password needs ${problems.join(", ")}`);
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const passwordHash = await hashPassword(input.password);
  return withUser(userId, async (db) => {
    await db.query(`INSERT INTO users (id, email, password_hash, display_name, locale) VALUES ($1, $2, $3, $4, $5)`, [
      userId,
      input.email.trim().toLowerCase(),
      passwordHash,
      input.displayName.trim(),
      input.locale,
    ]);
    await createWorkspaceFor(db, userId, workspaceId, input.locale === "ar" ? "مساحتي" : "My workspace");
    return { userId, workspaceId };
  });
}

export async function createWorkspaceFor(db: Db, userId: string, workspaceId: string, name: string): Promise<void> {
  await db.query(`INSERT INTO workspaces (id, name, owner_id) VALUES ($1, $2, $3)`, [workspaceId, name, userId]);
  await db.query(`INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`, [workspaceId, userId]);
}

/** Returns the user id on success. Same error and similar timing for unknown email and wrong password. */
export async function authenticate(email: string, password: string): Promise<string> {
  const row = await withAnon(async (db) => {
    const r = await db.query<{ user_id: string; password_hash: string; disabled_at: Date | null; locked_until: Date | null }>(
      "SELECT * FROM omnix_auth_lookup($1)",
      [email.trim().toLowerCase()],
    );
    return r.rows[0] ?? null;
  });
  if (!row) {
    await verifyPassword(password, await dummyHash());
    throw new AppError("UNAUTHENTICATED", "Email or password is incorrect");
  }
  if (row.locked_until && row.locked_until > new Date()) {
    throw new AppError("RATE_LIMITED", "Too many failed attempts. Try again later.", {
      headers: { "Retry-After": String(Math.ceil((row.locked_until.getTime() - Date.now()) / 1000)) },
    });
  }
  const ok = await verifyPassword(password, row.password_hash);
  await withAnon((db) =>
    db.query(ok ? "SELECT omnix_auth_record_success($1)" : "SELECT omnix_auth_record_failure($1)", [row.user_id]),
  );
  if (!ok || row.disabled_at) throw new AppError("UNAUTHENTICATED", "Email or password is incorrect");
  return row.user_id;
}

export async function createSession(userId: string, meta: { userAgent?: string | null; ip?: string | null }): Promise<string> {
  const token = newSessionToken();
  const ttlHours = env().OMNIX_SESSION_TTL_HOURS;
  await withUser(userId, (db) =>
    db.query(
      `INSERT INTO sessions (user_id, token_hash, user_agent, ip, expires_at)
       VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5))`,
      [userId, sha256(token), meta.userAgent?.slice(0, 512) ?? null, meta.ip ?? null, ttlHours],
    ),
  );
  return token;
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  await withUser(userId, (db) => db.query("UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL", [sessionId]));
}

async function resolveWorkspace(userId: string, requested: string | null): Promise<string> {
  return withUser(userId, async (db) => {
    if (requested && /^[0-9a-f-]{36}$/i.test(requested)) {
      const r = await db.query("SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2", [requested, userId]);
      if (r.rowCount) return requested;
    }
    const r = await db.query<{ workspace_id: string }>(
      `SELECT workspace_id FROM workspace_members WHERE user_id = $1
        ORDER BY (role = 'owner') DESC, created_at ASC LIMIT 1`,
      [userId],
    );
    const ws = r.rows[0]?.workspace_id;
    if (!ws) throw new AppError("FORBIDDEN", "No workspace");
    return ws;
  });
}

function parseCookies(header: string | null): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out.set(part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim()));
  }
  return out;
}

/** Resolves the caller from a Bearer API key or the session cookie. Returns null if neither is valid. */
export async function resolveAuth(req: Request): Promise<AuthContext | null> {
  const authz = req.headers.get("authorization");
  if (authz?.startsWith("Bearer ")) {
    const token = authz.slice(7).trim();
    if (!isApiKeyShape(token)) return null;
    const key = await withAnon(async (db) => {
      const r = await db.query<{ key_id: string; owner_id: string; workspace_id: string; scopes: ApiScope[] }>(
        "SELECT * FROM omnix_api_key_lookup($1)",
        [sha256(token)],
      );
      return r.rows[0] ?? null;
    });
    if (!key) return null;
    await withUser(key.owner_id, (db) => db.query("UPDATE ai_api_keys SET last_used_at = now() WHERE id = $1", [key.key_id]));
    return { userId: key.owner_id, workspaceId: key.workspace_id, via: "api_key", scopes: new Set(key.scopes), apiKeyId: key.key_id };
  }
  const cookies = parseCookies(req.headers.get("cookie"));
  const token = cookies.get(SESSION_COOKIE);
  if (!token || token.length > 100) return null;
  return resolveSessionToken(token, cookies.get(WORKSPACE_COOKIE) ?? req.headers.get("x-workspace-id"));
}

export async function resolveSessionToken(token: string, requestedWorkspace: string | null | undefined): Promise<AuthContext | null> {
  const s = await withAnon(async (db) => {
    const r = await db.query<{ session_id: string; user_id: string }>("SELECT * FROM omnix_session_lookup($1)", [sha256(token)]);
    return r.rows[0] ?? null;
  });
  if (!s) return null;
  const workspaceId = await resolveWorkspace(s.user_id, requestedWorkspace ?? null);
  return { userId: s.user_id, workspaceId, via: "session", scopes: "all", sessionId: s.session_id };
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
