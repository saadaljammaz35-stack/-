import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { credentialsKey, importEncryptionKey, toBase64 } from "../_shared/crypto.ts";
import { ConfigError } from "../_shared/env.ts";
import { handle } from "../_shared/http.ts";
import { type DbError, DEFAULTS, FakeDb, type Row, scopedTo, staffRequest } from "../_shared/whatsapp/testing.ts";
import { createHandler, type Deps, encryptionConfigured } from "./handler.ts";

Deno.env.set("SUPABASE_URL", "https://project.supabase.co/");
Deno.env.delete("ANTHROPIC_MODEL");

const ORG = "00000000-0000-4000-8000-00000000000a";
const OTHER_ORG = "00000000-0000-4000-8000-00000000000b";
const WEBHOOK_KEY = "cd".repeat(18);
const VALID_KEY = toBase64(new Uint8Array(32).map((_, i) => i + 1));

const ENTITLEMENTS = {
  plan: "starter",
  status: "trialing",
  is_active: true,
  trial_ends_at: "2026-10-26T09:00:00Z",
  current_period_end: null,
  ai_replies_limit: 300,
  ai_replies_used: 12,
  ai_replies_remaining: 288,
  seats_limit: 3,
  seats_used: 2,
};

const INTEGRATION: Row = {
  ...DEFAULTS.integration_settings!(),
  id: "20000000-0000-4000-8000-000000000001",
  organization_id: ORG,
  status: "connected",
  phone_number_id: "106540352242922",
  display_phone_number: "+966 50 000 0001",
  verified_name: "Smile Clinic",
  webhook_key: WEBHOOK_KEY,
  credentials_verified_at: "2026-10-10T08:00:00Z",
  webhook_verified_at: "2026-10-10T08:05:00Z",
  last_inbound_at: "2026-10-12T07:00:00Z",
  last_error: "Meta error 131047",
};

const FOREIGN_INTEGRATION: Row = {
  ...INTEGRATION,
  id: "20000000-0000-4000-8000-000000000002",
  organization_id: OTHER_ORG,
  status: "error",
  webhook_key: "ef".repeat(18),
  last_error: "other clinic's error",
};

class StatusDb extends FakeDb {
  override rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: DbError | null }> {
    if (fn !== "org_entitlements") return super.rpc(fn, args);
    this.rpcs.push({ fn, args });
    const injected = this.options.fail?.({ table: `rpc:${fn}`, action: "select", filters: [] });
    if (injected) return Promise.resolve({ data: null, error: injected });
    return Promise.resolve({ data: args.p_org === ORG ? ENTITLEMENTS : null, error: null });
  }
}

function setup(integrations: Row[] = [INTEGRATION, FOREIGN_INTEGRATION]): StatusDb {
  return new StatusDb({
    tables: {
      organization_members: [
        { organization_id: ORG, user_id: "user-owner", role: "owner" },
        { organization_id: ORG, user_id: "user-admin", role: "admin" },
        { organization_id: ORG, user_id: "user-recep", role: "receptionist" },
        { organization_id: OTHER_ORG, user_id: "user-other", role: "owner" },
      ],
      clinic_settings: [
        {
          organization_id: ORG,
          assistant_enabled: true,
          ai_last_test_at: "2026-10-11T10:00:00Z",
          ai_last_test_ok: true,
        },
        { organization_id: OTHER_ORG, assistant_enabled: false, ai_last_test_at: null, ai_last_test_ok: false },
      ],
      integration_settings: integrations,
    },
    users: {
      "token-owner": "user-owner",
      "token-admin": "user-admin",
      "token-recep": "user-recep",
      "token-other": "user-other",
    },
  });
}

const validKey = () => importEncryptionKey(VALID_KEY);

function run(
  db: FakeDb,
  token = "token-owner",
  loadEncryptionKey: Deps["loadEncryptionKey"] = validKey,
  body: unknown = { organization_id: ORG },
): Promise<Response> {
  return handle("system-status", createHandler(() => ({ db: db.db, loadEncryptionKey })))(staffRequest(body, token));
}

function withEnv(name: string, value: string | undefined): () => void {
  const previous = Deno.env.get(name);
  if (value === undefined) Deno.env.delete(name);
  else Deno.env.set(name, value);
  return () => (previous === undefined ? Deno.env.delete(name) : Deno.env.set(name, previous));
}

Deno.test("an owner sees the full status of their own clinic", async () => {
  const restore = withEnv("ANTHROPIC_API_KEY", "sk-ant-test-key");
  try {
    const db = setup();
    const res = await run(db);
    assertEquals(res.status, 200);
    assertEquals(await res.json(), {
      role: "owner",
      ai: {
        configured: true,
        model: "claude-opus-5-5",
        enabled: true,
        last_test_at: "2026-10-11T10:00:00Z",
        last_test_ok: true,
      },
      whatsapp: {
        status: "connected",
        display_phone_number: "+966 50 000 0001",
        verified_name: "Smile Clinic",
        credentials_verified_at: "2026-10-10T08:00:00Z",
        webhook_verified_at: "2026-10-10T08:05:00Z",
        last_inbound_at: "2026-10-12T07:00:00Z",
        last_error: "Meta error 131047",
        webhook_url: `https://project.supabase.co/functions/v1/whatsapp-webhook/${WEBHOOK_KEY}`,
      },
      encryption_configured: true,
      entitlements: ENTITLEMENTS,
      payments: { enabled: false, provider: null },
    });

    for (const table of ["clinic_settings", "integration_settings"]) {
      const calls = db.callsTo(table, "select");
      assertEquals(calls.length, 1, table);
      assert(scopedTo(calls[0]!, ORG), `${table} must be filtered by organization_id`);
    }
    assertEquals(db.rpcs.find((r) => r.fn === "org_entitlements")?.args, { p_org: ORG });
  } finally {
    restore();
  }
});

Deno.test("receptionists get the summary without webhook_url and last_error", async () => {
  const res = await run(setup(), "token-recep");
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.role, "receptionist");
  assertEquals(body.whatsapp.status, "connected");
  assert(!("webhook_url" in body.whatsapp));
  assert(!("last_error" in body.whatsapp));
  assertEquals(body.entitlements, ENTITLEMENTS);
});

Deno.test("admins see webhook_url and last_error", async () => {
  const body = await (await run(setup(), "token-admin")).json();
  assertEquals(body.role, "admin");
  assertEquals(body.whatsapp.last_error, "Meta error 131047");
  assertEquals(body.whatsapp.webhook_url, `https://project.supabase.co/functions/v1/whatsapp-webhook/${WEBHOOK_KEY}`);
});

Deno.test("no integration row reads as disconnected with empty fields", async () => {
  const body = await (await run(setup([FOREIGN_INTEGRATION]))).json();
  assertEquals(body.whatsapp, {
    status: "disconnected",
    display_phone_number: null,
    verified_name: null,
    credentials_verified_at: null,
    webhook_verified_at: null,
    last_inbound_at: null,
    last_error: null,
    webhook_url: null,
  });
});

Deno.test("ai.configured is false without ANTHROPIC_API_KEY, and the model can be overridden", async () => {
  const restoreKey = withEnv("ANTHROPIC_API_KEY", undefined);
  const restoreModel = withEnv("ANTHROPIC_MODEL", "claude-sonnet-5");
  try {
    const body = await (await run(setup())).json();
    assertEquals(body.ai.configured, false);
    assertEquals(body.ai.model, "claude-sonnet-5");
    // The last real test result is still reported as stored.
    assertEquals(body.ai.last_test_ok, true);
  } finally {
    restoreModel();
    restoreKey();
  }
});

Deno.test("a whitespace-only API key does not count as configured", async () => {
  const restore = withEnv("ANTHROPIC_API_KEY", "   ");
  try {
    assertEquals((await (await run(setup())).json()).ai.configured, false);
  } finally {
    restore();
  }
});

Deno.test("encryption_configured is false for a malformed CREDENTIALS_ENCRYPTION_KEY", async () => {
  // Valid base64, but 12 bytes instead of 32. The only test that goes through the cached live loader.
  const restore = withEnv("CREDENTIALS_ENCRYPTION_KEY", toBase64(new Uint8Array(12).fill(7)));
  try {
    const res = await run(setup(), "token-owner", credentialsKey);
    assertEquals(res.status, 200);
    assertEquals((await res.json()).encryption_configured, false);
  } finally {
    restore();
  }
});

Deno.test("encryptionConfigured accepts only a key that imports as a 32-byte AES key", async () => {
  assertEquals(await encryptionConfigured(validKey), true);
  assertEquals(await encryptionConfigured(() => importEncryptionKey("%%% not base64 %%%")), false);
  assertEquals(await encryptionConfigured(() => importEncryptionKey(toBase64(new Uint8Array(16)))), false);
  assertEquals(await encryptionConfigured(() => importEncryptionKey(toBase64(new Uint8Array(33)))), false);
  // A missing key throws synchronously from credentialsKey(); that must not escape either.
  assertEquals(
    await encryptionConfigured(() => {
      throw new ConfigError("CREDENTIALS_ENCRYPTION_KEY");
    }),
    false,
  );
});

Deno.test("clinics without settings report the assistant as off", async () => {
  const db = setup();
  db.tables.clinic_settings = db.table("clinic_settings").filter((row) => row.organization_id !== ORG);
  const body = await (await run(db)).json();
  assertEquals(body.ai.enabled, false);
  assertEquals(body.ai.last_test_at, null);
  assertEquals(body.ai.last_test_ok, null);
});

Deno.test("non-members get 403 and nothing about the clinic is read", async () => {
  const db = setup();
  const res = await run(db, "token-other");
  assertEquals(res.status, 403);
  assertEquals((await res.json()).error, "forbidden");
  assertEquals(db.callsTo("clinic_settings").length, 0);
  assertEquals(db.callsTo("integration_settings").length, 0);
  assertEquals(db.rpcs.filter((r) => r.fn === "org_entitlements").length, 0);
});

Deno.test("requires a session and a valid organization_id", async () => {
  assertEquals((await run(setup(), "")).status, 401);
  const res = await run(setup(), "token-owner", validKey, { organization_id: "nope" });
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "invalid_request");
});

Deno.test("a failed entitlements lookup is a database error, not a partial status", async () => {
  const db = new StatusDb({
    tables: { organization_members: [{ organization_id: ORG, user_id: "user-owner", role: "owner" }] },
    users: { "token-owner": "user-owner" },
    fail: (call) => call.table === "rpc:org_entitlements" ? { code: "42501", message: "forbidden" } : null,
  });
  const res = await run(db);
  assertEquals(res.status, 500);
  assertEquals((await res.json()).error, "database_error");
});
