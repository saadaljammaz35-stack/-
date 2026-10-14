// invite-member: owners and admins add staff to their clinic (see docs/API.md).
//
// An address that already has an account is added directly; a new address gets
// a Supabase invitation email. The seat limit is checked here for a clear error
// and enforced again by a database trigger, which also covers concurrent invites.

import { type Db, dbFailure, requireMembership, requireUser, serviceClient, writeAudit } from "../_shared/db.ts";
import { z } from "../_shared/deps.ts";
import { cleanSecret, ConfigError, requireEnv } from "../_shared/env.ts";
import { type Handler, HttpError, json, parse, readJson, type RequestContext } from "../_shared/http.ts";
import { log } from "../_shared/log.ts";
import { rateLimit } from "../_shared/ratelimit.ts";

export interface Deps {
  db: Db;
}

export function liveDeps(): Deps {
  return { db: serviceClient() };
}

const Body = z.object({
  organization_id: z.uuid(),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  // Owners are made only by transferring ownership, never by invitation.
  role: z.enum(["admin", "receptionist"]),
  full_name: z.string().trim().min(1).max(120).optional(),
});

type Input = z.infer<typeof Body>;

const SeatCounts = z.object({
  seats_used: z.number().int().nonnegative(),
  // Null when the clinic has no subscription row; the database trigger then imposes no limit either.
  seats_limit: z.number().int().nonnegative().nullable(),
});

interface PostgresError {
  code?: string;
  message?: string;
  hint?: string;
}

function seatLimit(): HttpError {
  return new HttpError(409, "seat_limit", "All seats on this plan are taken");
}

function alreadyMember(): HttpError {
  return new HttpError(409, "already_member", "This person is already a member of the clinic");
}

async function findUserId(db: Db, email: string): Promise<string | null> {
  const { data, error } = await db.rpc("find_user_id_by_email", { p_email: email });
  if (error) dbFailure("find_user_by_email", error);
  return typeof data === "string" && data !== "" ? data : null;
}

async function isMember(db: Db, organizationId: string, userId: string): Promise<boolean> {
  const { data, error } = await db
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) dbFailure("member_lookup", error);
  return data !== null;
}

async function requireFreeSeat(db: Db, organizationId: string): Promise<void> {
  const { data, error } = await db.rpc("org_entitlements", { p_org: organizationId });
  if (error) dbFailure("org_entitlements", error);
  const seats = SeatCounts.safeParse(data);
  if (!seats.success) dbFailure("org_entitlements_shape", { message: "seat counts missing from org_entitlements" });
  const { seats_used, seats_limit } = seats.data;
  if (seats_limit !== null && seats_used >= seats_limit) throw seatLimit();
}

/** Sends the Supabase invitation email and returns the new account's id. */
async function inviteNewAccount(db: Db, input: Input): Promise<string> {
  const siteUrl = cleanSecret(requireEnv("SITE_URL")).replace(/\/+$/, "");
  if (!/^https?:\/\/[^/]+/.test(siteUrl)) throw new ConfigError("SITE_URL");
  const redirectTo = `${siteUrl}/auth/accept-invite`;
  const { data, error } = await db.auth.admin.inviteUserByEmail(input.email, {
    redirectTo,
    data: input.full_name === undefined ? {} : { full_name: input.full_name },
  });
  if (error || !data.user) {
    // Codes only: the auth error message can contain the address.
    log.error("invite_member.invite_failed", { status: error?.status ?? null, code: error?.code ?? null });
    throw new HttpError(502, "upstream_error", "The invitation email could not be sent", {
      provider: "supabase_auth",
    });
  }
  return data.user.id;
}

async function insertMember(
  db: Db,
  row: { organization_id: string; user_id: string; role: Input["role"]; invited_by: string },
): Promise<string> {
  const { data, error } = await db.from("organization_members").insert(row).select("id").single();
  if (error) {
    const pgError = error as PostgresError;
    if (pgError.code === "23514" && /seat[_ ]limit/i.test(`${pgError.hint ?? ""} ${pgError.message ?? ""}`)) {
      throw seatLimit();
    }
    // unique (organization_id, user_id): a concurrent invite added the same person first.
    if (pgError.code === "23505") throw alreadyMember();
    dbFailure("member_insert", pgError);
  }
  const id = (data as { id?: unknown } | null)?.id;
  if (typeof id !== "string") dbFailure("member_insert", { message: "insert returned no row" });
  return id;
}

export function createHandler(getDeps: () => Deps): Handler {
  return async (req: Request, ctx: RequestContext): Promise<Response> => {
    const { db } = getDeps();
    const user = await requireUser(req, db);
    const input = parse(Body, await readJson(req, 4 * 1024));
    // Also bounds how fast a caller can learn which addresses have accounts.
    await rateLimit(db, `invite:user:${user.id}`, 20, 3600);

    const organizationId = input.organization_id;
    const callerRole = await requireMembership(db, user.id, organizationId, ["owner", "admin"]);
    if (callerRole === "admin" && input.role !== "receptionist") {
      throw new HttpError(403, "insufficient_role", "Admins can invite receptionists only");
    }

    const existingUserId = await findUserId(db, input.email);
    if (existingUserId !== null && await isMember(db, organizationId, existingUserId)) throw alreadyMember();
    // Before any email goes out, so nobody is invited into a clinic that has no seat for them.
    await requireFreeSeat(db, organizationId);

    const newAccount = existingUserId === null;
    const userId = existingUserId ?? await inviteNewAccount(db, input);
    const memberId = await insertMember(db, {
      organization_id: organizationId,
      user_id: userId,
      role: input.role,
      invited_by: user.id,
    });

    await writeAudit(db, {
      organizationId,
      actorUserId: user.id,
      actorType: "user",
      action: "member.invited",
      entityType: "organization_members",
      entityId: memberId,
      details: { role: input.role, new_account: newAccount },
    });
    log.info("invite_member.added", {
      request_id: ctx.requestId,
      organization_id: organizationId,
      member_id: memberId,
      new_account: newAccount,
    });

    return json(req, { member_id: memberId, invited: newAccount });
  };
}
