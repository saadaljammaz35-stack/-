// Database access and caller identity.
//
// Functions talk to Postgres with the service role, which bypasses RLS, so
// every staff-facing function must establish who is calling (requireUser) and
// what they may do in which clinic (requireMembership) before touching data.
// Every query below that function boundary must still filter by the clinic id
// it was authorised for.

import { createClient, type SupabaseClient, type User } from "./deps.ts";
import { requireEnv } from "./env.ts";
import { HttpError } from "./http.ts";
import { log } from "./log.ts";

export type Db = SupabaseClient;
export type Role = "owner" | "admin" | "receptionist";

let cached: Db | undefined;

export function serviceClient(): Db {
  cached ??= createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-client-info": "clinibot-edge" } },
  });
  return cached;
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

/** Verifies the caller's Supabase access token with the Auth server. */
export async function requireUser(req: Request, db: Db): Promise<User> {
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, "unauthorized", "Sign in required");
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "unauthorized", "Session is invalid or expired");
  return data.user;
}

/** Returns the caller's role in the clinic, or rejects with 403. */
export async function requireMembership(db: Db, userId: string, organizationId: string, roles?: Role[]): Promise<Role> {
  const { data, error } = await db
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) dbFailure("membership_lookup", error);
  if (!data) throw new HttpError(403, "forbidden", "You are not a member of this clinic");
  const role = data.role as Role;
  if (roles && !roles.includes(role)) throw new HttpError(403, "insufficient_role", "Your role cannot do this");
  return role;
}

/** Logs a database error and fails the request without leaking internals. */
export function dbFailure(context: string, error: { message?: string; code?: string }): never {
  log.error("db.error", { context, code: error.code, detail: error.message });
  throw new HttpError(500, "database_error", "A database operation failed");
}

export async function writeAudit(
  db: Db,
  entry: {
    organizationId: string | null;
    actorUserId?: string | null;
    actorType: "user" | "system" | "assistant" | "webhook";
    action: string;
    entityType?: string;
    entityId?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await db.rpc("write_audit", {
    p_org: entry.organizationId,
    p_actor: entry.actorUserId ?? null,
    p_actor_type: entry.actorType,
    p_action: entry.action,
    p_entity_type: entry.entityType ?? null,
    p_entity_id: entry.entityId ?? null,
    p_details: entry.details ?? {},
  });
  // An audit write failing must not break the user's action, but it must be visible.
  if (error) log.error("audit.write_failed", { action: entry.action, code: error.code, detail: error.message });
}
