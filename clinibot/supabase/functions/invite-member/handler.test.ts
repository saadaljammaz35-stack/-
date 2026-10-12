import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { handle } from "../_shared/http.ts";
import { type Call, type DbError, FakeDb, type Row, scopedTo, staffRequest } from "../_shared/whatsapp/testing.ts";
import { createHandler } from "./handler.ts";

Deno.env.set("SITE_URL", "https://app.clinibot.sa/");

const ORG = "00000000-0000-4000-8000-00000000000a";
const OTHER_ORG = "00000000-0000-4000-8000-00000000000b";
const EXISTING_USER = "00000000-0000-4000-8000-0000000000e1";
const INVITED_USER = "00000000-0000-4000-8000-0000000000f1";

interface InviteCall {
  email: string;
  options: { redirectTo?: string; data?: Record<string, unknown> } | undefined;
}

interface InviteOptions {
  seats?: { seats_used: number; seats_limit: number | null };
  /** Lowercased email → existing auth user id. */
  accounts?: Record<string, string>;
  inviteError?: { status: number; code: string; message: string };
  fail?: (call: Call) => DbError | null;
  rateLimited?: boolean;
}

/** FakeDb plus the auth admin API and the RPCs this function calls. */
class InviteDb extends FakeDb {
  readonly invites: InviteCall[] = [];

  constructor(private readonly setup: InviteOptions = {}) {
    super({
      tables: {
        organization_members: [
          { id: "m-owner", organization_id: ORG, user_id: "user-owner", role: "owner" },
          { id: "m-admin", organization_id: ORG, user_id: "user-admin", role: "admin" },
          { id: "m-recep", organization_id: ORG, user_id: "user-recep", role: "receptionist" },
          { id: "m-other", organization_id: OTHER_ORG, user_id: "user-other", role: "owner" },
          { id: "m-existing-elsewhere", organization_id: OTHER_ORG, user_id: EXISTING_USER, role: "admin" },
        ],
      },
      users: {
        "token-owner": "user-owner",
        "token-admin": "user-admin",
        "token-recep": "user-recep",
        "token-other": "user-other",
      },
      fail: setup.fail,
      rateLimited: setup.rateLimited,
    });
    Object.assign(this.auth, {
      admin: {
        inviteUserByEmail: (email: string, options?: InviteCall["options"]) => {
          this.invites.push({ email, options });
          const failure = this.setup.inviteError;
          return Promise.resolve(
            failure
              ? { data: { user: null }, error: { name: "AuthApiError", ...failure } }
              : { data: { user: { id: INVITED_USER, email } }, error: null },
          );
        },
      },
    });
  }

  override rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: DbError | null }> {
    if (fn === "org_entitlements") {
      this.rpcs.push({ fn, args });
      const seats = this.setup.seats ?? { seats_used: 3, seats_limit: 5 };
      return Promise.resolve({ data: { plan: "starter", status: "active", is_active: true, ...seats }, error: null });
    }
    if (fn === "find_user_id_by_email") {
      this.rpcs.push({ fn, args });
      return Promise.resolve({ data: this.setup.accounts?.[String(args.p_email)] ?? null, error: null });
    }
    return super.rpc(fn, args);
  }

  members(organizationId: string): Row[] {
    return this.table("organization_members").filter((row) => row.organization_id === organizationId);
  }
}

function run(db: InviteDb, body: Record<string, unknown>, token = "token-owner"): Promise<Response> {
  return handle("invite-member", createHandler(() => ({ db: db.db })))(staffRequest(body, token));
}

const INVITE = { organization_id: ORG, email: "  Rana@Clinic.SA ", role: "receptionist", full_name: "Rana" };

Deno.test("invites a new address by email, then adds the membership", async () => {
  const db = new InviteDb();
  const res = await run(db, INVITE);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.invited, true);

  assertEquals(db.invites.length, 1);
  assertEquals(db.invites[0]!.email, "rana@clinic.sa");
  assertEquals(db.invites[0]!.options, {
    redirectTo: "https://app.clinibot.sa/auth/accept-invite",
    data: { full_name: "Rana" },
  });

  const added = db.members(ORG).find((row) => row.user_id === INVITED_USER);
  assertEquals(added?.id, body.member_id);
  assertEquals(added?.role, "receptionist");
  assertEquals(added?.invited_by, "user-owner");
  assertEquals(db.rpcs.find((r) => r.fn === "find_user_id_by_email")?.args, { p_email: "rana@clinic.sa" });
  assertEquals(db.rpcs.find((r) => r.fn === "org_entitlements")?.args, { p_org: ORG });
  assertEquals(db.audits, [{
    action: "member.invited",
    org: ORG,
    entity: body.member_id,
    details: { role: "receptionist", new_account: true },
  }]);
});

Deno.test("adds an existing account directly without sending an invitation", async () => {
  const db = new InviteDb({ accounts: { "rana@clinic.sa": EXISTING_USER } });
  const res = await run(db, { ...INVITE, role: "admin" });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.invited, false);
  assertEquals(db.invites.length, 0);

  const added = db.members(ORG).find((row) => row.user_id === EXISTING_USER);
  assertEquals(added?.id, body.member_id);
  assertEquals(added?.role, "admin");
  // The account's membership in another clinic is not "already a member" here: the lookup is scoped to ORG.
  const lookup = db.callsTo("organization_members", "select").find((c) =>
    c.filters.some((f) => f.column === "user_id" && f.value === EXISTING_USER)
  );
  assert(lookup && scopedTo(lookup, ORG));
  assertEquals(db.audits[0]?.details, { role: "admin", new_account: false });
});

Deno.test("an admin may invite receptionists but not admins", async () => {
  const denied = new InviteDb();
  const res = await run(denied, { ...INVITE, role: "admin" }, "token-admin");
  assertEquals(res.status, 403);
  assertEquals((await res.json()).error, "insufficient_role");
  assertEquals(denied.invites.length, 0);
  assertEquals(denied.callsTo("organization_members", "insert").length, 0);

  const allowed = new InviteDb();
  const ok = await run(allowed, INVITE, "token-admin");
  assertEquals(ok.status, 200);
  assertEquals(allowed.members(ORG).find((row) => row.user_id === INVITED_USER)?.invited_by, "user-admin");
});

Deno.test("receptionists and other clinics cannot invite", async () => {
  const recep = await run(new InviteDb(), INVITE, "token-recep");
  assertEquals(recep.status, 403);
  assertEquals((await recep.json()).error, "insufficient_role");

  const db = new InviteDb();
  const outsider = await run(db, INVITE, "token-other");
  assertEquals(outsider.status, 403);
  assertEquals((await outsider.json()).error, "forbidden");
  assertEquals(db.invites.length, 0);
  assertEquals(db.members(ORG).length, 3);

  const anonymous = await run(new InviteDb(), INVITE, "");
  assertEquals(anonymous.status, 401);
});

Deno.test("owners cannot be invited and the input is validated", async () => {
  for (
    const body of [
      { ...INVITE, role: "owner" },
      { ...INVITE, email: "not-an-email" },
      { ...INVITE, full_name: "x".repeat(121) },
      { ...INVITE, full_name: "" },
      { ...INVITE, organization_id: "not-a-uuid" },
    ]
  ) {
    const db = new InviteDb();
    const res = await run(db, body);
    assertEquals(res.status, 400);
    assertEquals((await res.json()).error, "invalid_request");
    assertEquals(db.invites.length, 0);
  }
});

Deno.test("full_name is optional", async () => {
  const db = new InviteDb();
  const { full_name: _omitted, ...withoutName } = INVITE;
  const res = await run(db, withoutName);
  assertEquals(res.status, 200);
  assertEquals(db.invites[0]?.options?.data, {});
});

Deno.test("a full clinic gets 409 seat_limit before any email is sent", async () => {
  const db = new InviteDb({ seats: { seats_used: 5, seats_limit: 5 } });
  const res = await run(db, INVITE);
  assertEquals(res.status, 409);
  assertEquals((await res.json()).error, "seat_limit");
  assertEquals(db.invites.length, 0);
  assertEquals(db.callsTo("organization_members", "insert").length, 0);
  assertEquals(db.audits.length, 0);
});

Deno.test("the database seat trigger is reported as seat_limit", async () => {
  const seatError = { code: "23514", message: "seat limit reached for this plan", hint: "seat_limit" };
  const db = new InviteDb({
    accounts: { "rana@clinic.sa": EXISTING_USER },
    fail: (call) => call.table === "organization_members" && call.action === "insert" ? seatError : null,
  });
  const res = await run(db, INVITE);
  assertEquals(res.status, 409);
  assertEquals((await res.json()).error, "seat_limit");
  assertEquals(db.audits.length, 0);
});

Deno.test("other insert failures are database errors, not seat errors", async () => {
  const db = new InviteDb({
    accounts: { "rana@clinic.sa": EXISTING_USER },
    fail: (call) =>
      call.table === "organization_members" && call.action === "insert"
        ? { code: "23514", message: "new row violates check constraint" }
        : null,
  });
  const res = await run(db, INVITE);
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, "database_error");
});

Deno.test("an unlimited plan (no seat limit) does not block invites", async () => {
  const db = new InviteDb({ seats: { seats_used: 40, seats_limit: null } });
  const res = await run(db, INVITE);
  assertEquals(res.status, 200);
});

Deno.test("someone already in the clinic gets 409 already_member", async () => {
  const db = new InviteDb({ accounts: { "rana@clinic.sa": "user-recep" } });
  const res = await run(db, INVITE);
  assertEquals(res.status, 409);
  assertEquals((await res.json()).error, "already_member");
  assertEquals(db.invites.length, 0);
  assertEquals(db.callsTo("organization_members", "insert").length, 0);
});

Deno.test("a concurrent duplicate insert is reported as already_member", async () => {
  const db = new InviteDb({
    accounts: { "rana@clinic.sa": EXISTING_USER },
    fail: (call) =>
      call.table === "organization_members" && call.action === "insert"
        ? { code: "23505", message: "duplicate key value violates unique constraint" }
        : null,
  });
  const res = await run(db, INVITE);
  assertEquals(res.status, 409);
  assertEquals((await res.json()).error, "already_member");
});

Deno.test("a failed invitation is a 502 and adds no membership", async () => {
  const db = new InviteDb({
    inviteError: { status: 429, code: "over_email_send_rate_limit", message: "rana@clinic.sa" },
  });
  const logged: string[] = [];
  const original = console.error;
  console.error = (line: string) => logged.push(line);
  let res: Response;
  try {
    res = await run(db, INVITE);
  } finally {
    console.error = original;
  }
  assertEquals(res.status, 502);
  const body = await res.json();
  assertEquals(body.error, "upstream_error");
  assertEquals(body.details, { provider: "supabase_auth" });
  assertEquals(db.invites.length, 1);
  assertEquals(db.callsTo("organization_members", "insert").length, 0);
  assertEquals(db.members(ORG).length, 3);
  assertEquals(db.audits.length, 0);
  // Only the auth error code reaches the logs, never the address.
  assert(logged.some((line) => line.includes("over_email_send_rate_limit")));
  assert(logged.every((line) => !line.toLowerCase().includes("rana@clinic.sa")));
});

Deno.test("a missing SITE_URL is not_configured and sends nothing", async () => {
  Deno.env.delete("SITE_URL");
  try {
    const db = new InviteDb();
    const res = await run(db, INVITE);
    assertEquals(res.status, 503);
    const body = await res.json();
    assertEquals(body.error, "not_configured");
    assertEquals(body.details, { variable: "SITE_URL" });
    assertEquals(db.invites.length, 0);
    assertEquals(db.callsTo("organization_members", "insert").length, 0);
  } finally {
    Deno.env.set("SITE_URL", "https://app.clinibot.sa/");
  }
});

Deno.test("invites are rate limited per user", async () => {
  const db = new InviteDb({ rateLimited: true });
  const res = await run(db, INVITE);
  assertEquals(res.status, 429);
  assertEquals((await res.json()).error, "rate_limited");
  assertEquals(db.rpcs[0]?.fn, "consume_rate_limit");
  assertEquals(db.rpcs[0]?.args, { p_key: "invite:user:user-owner", p_limit: 20, p_window_seconds: 3600 });
  assertEquals(db.invites.length, 0);
});
