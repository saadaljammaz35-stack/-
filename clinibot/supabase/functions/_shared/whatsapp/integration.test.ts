import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { ConfigError } from "../env.ts";
import {
  canSend,
  graphConfig,
  type IntegrationRow,
  loadCredentials,
  loadIntegration,
  loadIntegrationByWebhookKey,
  saveCredentials,
  webhookUrl,
} from "./integration.ts";
import { DEFAULTS, FakeDb, scopedTo, setTestEnv, TEST_ENCRYPTION_KEY } from "./testing.ts";

setTestEnv();

const ORG_A = "00000000-0000-4000-8000-00000000000a";
const ORG_B = "00000000-0000-4000-8000-00000000000b";

function integration(id: string, organizationId: string, extra: Partial<IntegrationRow> = {}): IntegrationRow {
  return {
    ...(DEFAULTS.integration_settings!() as unknown as IntegrationRow),
    id,
    organization_id: organizationId,
    webhook_key: id.replace(/-/g, "").padEnd(36, "0").slice(0, 36),
    ...extra,
  };
}

const A = integration("11111111-1111-4111-8111-111111111111", ORG_A, {
  status: "connected",
  phone_number_id: "106540352242922",
});
const B = integration("22222222-2222-4222-8222-222222222222", ORG_B, {
  status: "connected",
  phone_number_id: "206540352242922",
});

function fakeDb(): FakeDb {
  return new FakeDb({
    tables: { integration_settings: [{ ...A, provider: "whatsapp" }, { ...B, provider: "whatsapp" }] },
  });
}

Deno.test("credentials round-trip through the database encrypted", async () => {
  const db = fakeDb();
  await saveCredentials(db.db, A, {
    accessToken: "EAAG-token-A",
    appSecret: "secret-A",
    verifyTokenHash: "a".repeat(64),
  });
  const stored = db.tables.integration_credentials?.[0];
  assertEquals(stored?.integration_id, A.id);
  assertEquals(stored?.organization_id, ORG_A);
  assertEquals(JSON.stringify(stored).includes("EAAG-token-A"), false);
  assertEquals(JSON.stringify(stored).includes("secret-A"), false);
  assertEquals(await loadCredentials(db.db, A), {
    accessToken: "EAAG-token-A",
    appSecret: "secret-A",
    verifyTokenHash: "a".repeat(64),
  });
  const read = db.callsTo("integration_credentials", "select")[0]!;
  assert(scopedTo(read, ORG_A));
});

Deno.test("saving again replaces the row instead of adding one", async () => {
  const db = fakeDb();
  await saveCredentials(db.db, A, { accessToken: "EAAG-old", appSecret: null, verifyTokenHash: null });
  await saveCredentials(db.db, A, { accessToken: "EAAG-new", appSecret: "s", verifyTokenHash: null });
  assertEquals(db.tables.integration_credentials?.length, 1);
  assertEquals((await loadCredentials(db.db, A))?.accessToken, "EAAG-new");
});

Deno.test("a missing app secret stays null", async () => {
  const db = fakeDb();
  await saveCredentials(db.db, A, { accessToken: "EAAG-token", appSecret: null, verifyTokenHash: null });
  assertEquals((await loadCredentials(db.db, A))?.appSecret, null);
});

Deno.test("a ciphertext copied into another clinic's row does not decrypt (AAD binding)", async () => {
  const db = fakeDb();
  await saveCredentials(db.db, A, { accessToken: "EAAG-token-A", appSecret: "secret-A", verifyTokenHash: null });
  const sealed = db.tables.integration_credentials![0]!;
  db.tables.integration_credentials!.push({ ...sealed, integration_id: B.id, organization_id: ORG_B });
  assertEquals(await loadCredentials(db.db, B), null);
});

Deno.test("the access token ciphertext cannot be read as the app secret", async () => {
  const db = fakeDb();
  await saveCredentials(db.db, A, { accessToken: "EAAG-token-A", appSecret: "secret-A", verifyTokenHash: null });
  const row = db.tables.integration_credentials![0]!;
  row.app_secret_ciphertext = row.access_token_ciphertext;
  assertEquals(await loadCredentials(db.db, A), null);
});

Deno.test("credentials of another clinic are never returned for this one", async () => {
  const db = fakeDb();
  await saveCredentials(db.db, B, { accessToken: "EAAG-token-B", appSecret: null, verifyTokenHash: null });
  // Same integration id, wrong organisation: the organization_id filter must exclude it.
  assertEquals(await loadCredentials(db.db, { id: B.id, organization_id: ORG_A }), null);
  assertEquals(await loadCredentials(db.db, A), null);
});

Deno.test("no encryption key is a configuration error", async () => {
  const db = fakeDb();
  Deno.env.delete("CREDENTIALS_ENCRYPTION_KEY");
  try {
    await assertRejects(
      () => saveCredentials(db.db, A, { accessToken: "EAAG", appSecret: null, verifyTokenHash: null }),
      ConfigError,
    );
  } finally {
    Deno.env.set("CREDENTIALS_ENCRYPTION_KEY", TEST_ENCRYPTION_KEY);
  }
});

Deno.test("loadIntegration is scoped to the clinic", async () => {
  const db = fakeDb();
  assertEquals((await loadIntegration(db.db, ORG_B))?.id, B.id);
  assertEquals(await loadIntegration(db.db, "00000000-0000-4000-8000-0000000000cc"), null);
  assert(
    db.callsTo("integration_settings", "select").every((call) =>
      call.filters.some((f) => f.column === "organization_id")
    ),
  );
});

Deno.test("loadIntegrationByWebhookKey finds the row and ignores malformed keys without a query", async () => {
  const db = fakeDb();
  assertEquals((await loadIntegrationByWebhookKey(db.db, A.webhook_key))?.organization_id, ORG_A);
  assertEquals(await loadIntegrationByWebhookKey(db.db, "f".repeat(36)), null);
  const queries = db.calls.length;
  for (const key of ["", "../x", "ABCDEF".repeat(6), "a".repeat(200), "a b"]) {
    assertEquals(await loadIntegrationByWebhookKey(db.db, key), null);
  }
  assertEquals(db.calls.length, queries);
});

Deno.test("webhookUrl points at the webhook function", () => {
  Deno.env.set("SUPABASE_URL", "https://project.supabase.co/");
  try {
    assertEquals(webhookUrl("abc123"), "https://project.supabase.co/functions/v1/whatsapp-webhook/abc123");
  } finally {
    Deno.env.set("SUPABASE_URL", "https://project.supabase.co");
  }
});

Deno.test("canSend requires a usable status and a phone number id", () => {
  assert(canSend(A));
  assert(canSend({ ...A, status: "credentials_verified" }));
  assertEquals(canSend({ ...A, status: "error" }), false);
  assertEquals(canSend({ ...A, status: "disconnected" }), false);
  assertEquals(canSend({ ...A, phone_number_id: null }), false);
  assertEquals(canSend(null), false);
});

Deno.test("graphConfig combines the row and the decrypted token", () => {
  assertEquals(graphConfig(A, { accessToken: "EAAG", appSecret: null, verifyTokenHash: null }), {
    accessToken: "EAAG",
    phoneNumberId: "106540352242922",
  });
});
