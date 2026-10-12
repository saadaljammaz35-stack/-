import { assert, assertEquals, assertExists } from "jsr:@std/assert@1.0.13";
import { sha256Hex } from "../_shared/crypto.ts";
import { handle } from "../_shared/http.ts";
import { loadCredentials } from "../_shared/whatsapp/integration.ts";
import {
  DEFAULTS,
  FakeDb,
  fakeFetch,
  type FetchReply,
  jsonResponse,
  metaError,
  type Row,
  saveTestCredentials,
  scopedTo,
  setTestEnv,
  staffRequest,
  TEST_ENCRYPTION_KEY,
} from "../_shared/whatsapp/testing.ts";
import { createHandler } from "./handler.ts";

setTestEnv();

const NOW = new Date("2026-10-12T09:00:00.000Z");
const ORG = "00000000-0000-4000-8000-00000000000a";
const OTHER_ORG = "00000000-0000-4000-8000-00000000000b";
const TOKEN = "EAAGsavedTOKENabcdefghijklmnop123456";
const APP_SECRET = "0123456789abcdef0123456789abcdef";

const SAVE = {
  action: "save",
  organization_id: ORG,
  phone_number_id: "106540352242922",
  waba_id: "102290129340398",
  access_token: TOKEN,
  app_secret: APP_SECRET,
};

const phoneInfo = () =>
  jsonResponse({
    display_phone_number: "+966 50 000 0001",
    verified_name: "Smile Clinic",
    quality_rating: "GREEN",
    id: "106540352242922",
  });

function members(): Row[] {
  return [
    { organization_id: ORG, user_id: "user-owner", role: "owner" },
    { organization_id: ORG, user_id: "user-admin", role: "admin" },
    { organization_id: ORG, user_id: "user-recep", role: "receptionist" },
    { organization_id: OTHER_ORG, user_id: "user-other", role: "owner" },
  ];
}

function setup(tables: Record<string, Row[]> = {}): FakeDb {
  return new FakeDb({
    tables: { organization_members: members(), ...tables },
    users: {
      "token-owner": "user-owner",
      "token-admin": "user-admin",
      "token-recep": "user-recep",
      "token-other": "user-other",
    },
    unique: { integration_settings: ["phone_number_id", "webhook_key"] },
  });
}

function settingsRow(organizationId: string, extra: Row = {}): Row {
  return {
    ...DEFAULTS.integration_settings!(),
    id: crypto.randomUUID(),
    organization_id: organizationId,
    webhook_key: crypto.randomUUID().replace(/-/g, "").padEnd(36, "0"),
    ...extra,
  };
}

async function call(db: FakeDb, body: unknown, replies: FetchReply[] = [], token = "token-owner") {
  const fake = fakeFetch(...replies);
  const response = await handle(
    "whatsapp-connect",
    createHandler(() => ({ db: db.db, fetch: fake.fetch, now: () => NOW })),
  )(
    staffRequest(body, token),
  );
  return { response, body: await response.json(), fetches: fake.calls };
}

Deno.test("save: verifies with Meta, stores encrypted credentials and returns the verify token once", async () => {
  const db = setup();
  const { response, body, fetches } = await call(db, SAVE, [phoneInfo(), jsonResponse({ success: true })]);
  assertEquals(response.status, 200);
  assertEquals(body.status, "credentials_verified");
  assertEquals(body.display_phone_number, "+966 50 000 0001");
  assertEquals(body.verified_name, "Smile Clinic");
  assertEquals(body.app_subscribed, true);
  assert(/^[A-Za-z0-9_-]{32}$/.test(body.verify_token));
  const settings = db.tables.integration_settings![0]!;
  assertEquals(body.webhook_url, `https://project.supabase.co/functions/v1/whatsapp-webhook/${settings.webhook_key}`);
  assertEquals(Object.keys(body).sort(), [
    "app_subscribed",
    "display_phone_number",
    "status",
    "verified_name",
    "verify_token",
    "webhook_url",
  ]);

  assertEquals(settings.organization_id, ORG);
  assertEquals(settings.status, "credentials_verified");
  assertEquals(settings.phone_number_id, "106540352242922");
  assertEquals(settings.waba_id, "102290129340398");
  assertEquals(settings.credentials_verified_at, NOW.toISOString());
  assertEquals(settings.webhook_verified_at, null);

  const stored = db.tables.integration_credentials![0]!;
  assertEquals(stored.organization_id, ORG);
  assertEquals(stored.integration_id, settings.id);
  assertEquals(stored.verify_token_hash, await sha256Hex(body.verify_token));
  const raw = JSON.stringify(db.tables);
  assertEquals(raw.includes(TOKEN), false);
  assertEquals(raw.includes(APP_SECRET), false);
  assertEquals(raw.includes(body.verify_token), false);
  const decrypted = await loadCredentials(db.db, { id: String(settings.id), organization_id: ORG });
  assertEquals(decrypted?.accessToken, TOKEN);
  assertEquals(decrypted?.appSecret, APP_SECRET);

  assertEquals(fetches.map((f) => [f.method, f.url]), [
    [
      "GET",
      "https://graph.facebook.com/v26.0/106540352242922?fields=display_phone_number,verified_name,quality_rating",
    ],
    ["POST", "https://graph.facebook.com/v26.0/102290129340398/subscribed_apps"],
  ]);
  assertEquals(fetches[0]?.headers.get("authorization"), `Bearer ${TOKEN}`);

  assertEquals(db.audits.map((a) => a.action), ["whatsapp.credentials_saved"]);
  assertEquals(JSON.stringify(db.audits).includes(TOKEN), false);
  assertEquals(JSON.stringify(db.audits).includes(APP_SECRET), false);
});

Deno.test("save: admins may connect, receptionists may not (and nothing is called or stored)", async () => {
  const admin = setup();
  assertEquals(
    (await call(admin, SAVE, [phoneInfo(), jsonResponse({ success: true })], "token-admin")).response.status,
    200,
  );

  const db = setup();
  const { response, body, fetches } = await call(db, SAVE, [], "token-recep");
  assertEquals(response.status, 403);
  assertEquals(body.error, "insufficient_role");
  assertEquals(fetches.length, 0);
  assertEquals(db.tables.integration_settings ?? [], []);
  assertEquals(db.tables.integration_credentials ?? [], []);
});

Deno.test("save: a member of another clinic is forbidden; no session is unauthorized", async () => {
  const db = setup();
  assertEquals((await call(db, SAVE, [], "token-other")).body.error, "forbidden");
  assertEquals((await call(db, SAVE, [], "token-unknown")).response.status, 401);
  assertEquals(db.tables.integration_settings ?? [], []);
});

Deno.test("save: Meta rejecting the token stores nothing and reports Meta's error", async () => {
  const db = setup();
  const { response, body } = await call(db, SAVE, [
    metaError(190, "Error validating access token: Session has expired.", 400),
  ]);
  assertEquals(response.status, 502);
  assertEquals(body.error, "upstream_error");
  assertEquals(body.details.provider, "meta");
  assertEquals(body.details.meta_code, 190);
  assert(String(body.details.meta_message).includes("Session has expired"));
  assertEquals(db.tables.integration_settings ?? [], []);
  assertEquals(db.tables.integration_credentials ?? [], []);
  assertEquals(db.audits, []);
});

Deno.test("save: with an existing integration, a Meta rejection is recorded but credentials are untouched", async () => {
  const existing = settingsRow(ORG, { status: "connected", phone_number_id: "106540352242922" });
  const db = setup({ integration_settings: [existing] });
  await saveTestCredentials(db, existing, "EAAGoldTOKEN0000000000000");
  const before = JSON.stringify(db.tables.integration_credentials);

  const { response } = await call(db, { ...SAVE, access_token: "EAAGnewBadToken0000000000" }, [
    metaError(190, "Invalid OAuth access token.", 401),
  ]);
  assertEquals(response.status, 502);
  const row = db.tables.integration_settings![0]!;
  assertEquals(row.status, "error");
  assert(String(row.last_error).includes("code 190"));
  assertEquals(String(row.last_error).includes("EAAG"), false);
  assertEquals(row.last_error_at, NOW.toISOString());
  assertEquals(JSON.stringify(db.tables.integration_credentials), before);
  for (const update of db.callsTo("integration_settings", "update")) assert(scopedTo(update, ORG));
});

Deno.test("save: a number connected to another clinic is refused before calling Meta", async () => {
  const db = setup({ integration_settings: [settingsRow(OTHER_ORG, { phone_number_id: "106540352242922" })] });
  const { response, body, fetches } = await call(db, SAVE);
  assertEquals(response.status, 409);
  assertEquals(body.error, "phone_number_in_use");
  assertEquals(fetches.length, 0);
  assertEquals(db.tables.integration_settings?.length, 1);
  assertEquals(db.tables.integration_credentials ?? [], []);
});

Deno.test("save: a unique violation from a concurrent claim is also phone_number_in_use", async () => {
  const db = new FakeDb({
    tables: { organization_members: members() },
    users: { "token-owner": "user-owner" },
    fail: (c) => (c.table === "integration_settings" && c.action === "upsert" ? { code: "23505" } : null),
  });
  const { response, body } = await call(db, SAVE, [phoneInfo()]);
  assertEquals(response.status, 409);
  assertEquals(body.error, "phone_number_in_use");
  assertEquals(db.tables.integration_credentials ?? [], []);
});

Deno.test("save: reconnecting the same clinic updates its row and replaces its credentials", async () => {
  const existing = settingsRow(ORG, {
    status: "error",
    phone_number_id: "106540352242922",
    webhook_verified_at: "2026-10-01T00:00:00Z",
    last_error: "old",
  });
  const db = setup({ integration_settings: [existing] });
  await saveTestCredentials(db, existing, "EAAGoldTOKEN0000000000000");
  const { response } = await call(db, SAVE, [phoneInfo(), jsonResponse({ success: true })]);
  assertEquals(response.status, 200);
  assertEquals(db.tables.integration_settings?.length, 1);
  const row = db.tables.integration_settings![0]!;
  assertEquals([row.id, row.status, row.last_error, row.webhook_verified_at], [
    existing.id,
    "credentials_verified",
    null,
    null,
  ]);
  assertEquals(db.tables.integration_credentials?.length, 1);
  assertEquals((await loadCredentials(db.db, { id: String(existing.id), organization_id: ORG }))?.accessToken, TOKEN);
});

Deno.test("save: a failed app subscription is reported, not hidden", async () => {
  const db = setup();
  const { response, body } = await call(db, SAVE, [phoneInfo(), metaError(200, "Permissions error", 403)]);
  assertEquals(response.status, 200);
  assertEquals(body.app_subscribed, false);
  assertEquals(db.audits[0]?.details, { app_subscribed: false });
});

Deno.test("save: input is validated before Meta is called", async () => {
  const db = setup();
  for (
    const bad of [
      { ...SAVE, phone_number_id: "12ab" },
      { ...SAVE, waba_id: "1234" },
      { ...SAVE, access_token: "short" },
      { ...SAVE, access_token: "EAAG token with spaces 1234567890" },
      { ...SAVE, app_secret: "x".repeat(300) },
      { ...SAVE, organization_id: "not-a-uuid" },
      { ...SAVE, action: "explode" },
    ]
  ) {
    const { response, body, fetches } = await call(db, bad);
    assertEquals(response.status, 400, JSON.stringify(bad));
    assertEquals(body.error, "invalid_request");
    assertEquals(fetches.length, 0);
    assertEquals(JSON.stringify(body).includes(TOKEN), false);
  }
});

Deno.test("save: a missing encryption key is 503 not_configured before anything happens", async () => {
  const db = setup();
  Deno.env.delete("CREDENTIALS_ENCRYPTION_KEY");
  try {
    const { response, body, fetches } = await call(db, SAVE, [phoneInfo()]);
    assertEquals(response.status, 503);
    assertEquals(body.details.variable, "CREDENTIALS_ENCRYPTION_KEY");
    assertEquals(fetches.length, 0);
    assertEquals(db.tables.integration_settings ?? [], []);
  } finally {
    Deno.env.set("CREDENTIALS_ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
  }
});

Deno.test("save: rate limited per user", async () => {
  const db = new FakeDb({
    tables: { organization_members: members() },
    users: { "token-owner": "user-owner" },
    rateLimited: true,
  });
  const { response, body, fetches } = await call(db, SAVE);
  assertEquals(response.status, 429);
  assertEquals(body.error, "rate_limited");
  assertEquals(fetches.length, 0);
  assertEquals(db.rpcs.find((r) => r.fn === "consume_rate_limit")?.args.p_key, "wa-connect:user:user-owner");
});

Deno.test("rotate_verify_token: stores a new hash and requires the webhook handshake again", async () => {
  const existing = settingsRow(ORG, {
    status: "connected",
    phone_number_id: "106540352242922",
    webhook_verified_at: "2026-10-01T00:00:00Z",
  });
  const db = setup({ integration_settings: [existing] });
  await saveTestCredentials(db, existing, TOKEN, "f".repeat(64));
  const { response, body } = await call(db, { action: "rotate_verify_token", organization_id: ORG });
  assertEquals(response.status, 200);
  assertEquals(db.tables.integration_credentials![0]!.verify_token_hash, await sha256Hex(body.verify_token));
  assertEquals(body.webhook_url, `https://project.supabase.co/functions/v1/whatsapp-webhook/${existing.webhook_key}`);
  const row = db.tables.integration_settings![0]!;
  assertEquals([row.status, row.webhook_verified_at], ["credentials_verified", null]);
  assertEquals((await loadCredentials(db.db, { id: String(existing.id), organization_id: ORG }))?.accessToken, TOKEN);
  assertEquals(db.audits.map((a) => a.action), ["whatsapp.verify_token_rotated"]);
});

Deno.test("rotate_verify_token without stored credentials is whatsapp_not_connected", async () => {
  const db = setup({ integration_settings: [settingsRow(ORG)] });
  const { response, body } = await call(db, { action: "rotate_verify_token", organization_id: ORG });
  assertEquals(response.status, 409);
  assertEquals(body.error, "whatsapp_not_connected");
});

Deno.test("test: success refreshes the number details and clears a previous error", async () => {
  const existing = settingsRow(ORG, {
    status: "error",
    phone_number_id: "106540352242922",
    webhook_verified_at: "2026-10-01T00:00:00Z",
    last_error: "Meta could not be reached",
  });
  const db = setup({ integration_settings: [existing] });
  await saveTestCredentials(db, existing, TOKEN);
  const { response, body, fetches } = await call(db, { action: "test", organization_id: ORG }, [phoneInfo()]);
  assertEquals(response.status, 200);
  assertEquals(body, {
    ok: true,
    display_phone_number: "+966 50 000 0001",
    verified_name: "Smile Clinic",
    quality_rating: "GREEN",
  });
  assertEquals(fetches[0]?.headers.get("authorization"), `Bearer ${TOKEN}`);
  const row = db.tables.integration_settings![0]!;
  assertEquals([row.status, row.last_error], ["connected", null]);
});

Deno.test("test: a rejected token sets status error and answers 502", async () => {
  const existing = settingsRow(ORG, { status: "connected", phone_number_id: "106540352242922" });
  const db = setup({ integration_settings: [existing] });
  await saveTestCredentials(db, existing, TOKEN);
  const { response, body } = await call(db, { action: "test", organization_id: ORG }, [
    metaError(190, "Error validating access token", 400),
  ]);
  assertEquals(response.status, 502);
  assertEquals(body.details.meta_code, 190);
  const row = db.tables.integration_settings![0]!;
  assertEquals(row.status, "error");
  assertExists(row.last_error);
  assertEquals(row.last_error_at, NOW.toISOString());
});

Deno.test("test: nothing connected is whatsapp_not_connected", async () => {
  const db = setup();
  const { response, body, fetches } = await call(db, { action: "test", organization_id: ORG });
  assertEquals(response.status, 409);
  assertEquals(body.error, "whatsapp_not_connected");
  assertEquals(fetches.length, 0);
});

Deno.test("disconnect: deletes this clinic's credentials, resets settings and leaves other clinics alone", async () => {
  const mine = settingsRow(ORG, {
    status: "connected",
    phone_number_id: "106540352242922",
    waba_id: "102290129340398",
    display_phone_number: "+966 50 000 0001",
    verified_name: "Smile",
    credentials_verified_at: "2026-10-01T00:00:00Z",
    webhook_verified_at: "2026-10-01T00:00:00Z",
    confirmation_template_name: "appointment_confirmed",
  });
  const theirs = settingsRow(OTHER_ORG, { status: "connected", phone_number_id: "206540352242922" });
  const db = setup({ integration_settings: [mine, theirs] });
  await saveTestCredentials(db, mine, TOKEN);
  await saveTestCredentials(db, theirs, "EAAGotherCLINICtoken000000");

  const { response, body } = await call(db, { action: "disconnect", organization_id: ORG });
  assertEquals(response.status, 200);
  assertEquals(body, { status: "disconnected" });
  assertEquals(db.tables.integration_credentials?.map((r) => r.organization_id), [OTHER_ORG]);
  const row = db.tables.integration_settings!.find((r) => r.organization_id === ORG)!;
  assertEquals(
    [
      row.status,
      row.phone_number_id,
      row.waba_id,
      row.display_phone_number,
      row.verified_name,
      row.credentials_verified_at,
      row.webhook_verified_at,
    ],
    ["disconnected", null, null, null, null, null, null],
  );
  assertEquals(row.confirmation_template_name, "appointment_confirmed");
  assertEquals(db.tables.integration_settings!.find((r) => r.organization_id === OTHER_ORG)?.status, "connected");
  assertEquals(db.audits.map((a) => a.action), ["whatsapp.disconnected"]);
  for (
    const c of [...db.callsTo("integration_credentials", "delete"), ...db.callsTo("integration_settings", "update")]
  ) {
    assert(scopedTo(c, ORG));
  }
});

Deno.test("disconnect is idempotent when nothing was connected", async () => {
  const db = setup();
  const { response, body } = await call(db, { action: "disconnect", organization_id: ORG });
  assertEquals(response.status, 200);
  assertEquals(body, { status: "disconnected" });
});
