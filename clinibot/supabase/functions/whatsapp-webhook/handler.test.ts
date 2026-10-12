import { assert, assertEquals, assertExists, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { hmacSha256Hex, sha256Hex } from "../_shared/crypto.ts";
import { handle } from "../_shared/http.ts";
import type { PipelineInput, PipelineOutbound, PipelineResult } from "../_shared/assistant/pipeline.ts";
import {
  type Call,
  type DbError,
  DEFAULTS,
  FakeDb,
  type FakeDbOptions,
  fakeFetch,
  type FetchReply,
  jsonResponse,
  metaError,
  type Row,
  saveTestCredentials,
  scopedTo,
  setTestEnv,
} from "../_shared/whatsapp/testing.ts";
import { createHandler, typeQuestionNotice } from "./handler.ts";

setTestEnv();

const NOW = new Date("2026-10-12T09:00:00.000Z");
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);
const ORG = "00000000-0000-4000-8000-00000000000a";
const OTHER_ORG = "00000000-0000-4000-8000-00000000000b";
const KEY = "0123456789abcdef0123456789abcdef0123";
const PHONE_ID = "106540352242922";
const APP_SECRET = "0123456789abcdef0123456789abcdef";
const ACCESS_TOKEN = "EAAGwebhookTOKENabcdefghijklmnop123456";
const VERIFY_TOKEN = "verify-token-abcdefghijklmnopqrstuvwxyz0123";
const CUSTOMER = "966512345678";
const CUSTOMER_NAME = "Sara Alqahtani";
const SEND_URL = `https://graph.facebook.com/v26.0/${PHONE_ID}/messages`;

const ASSISTANT_REPLY: PipelineOutbound = {
  sender: "assistant",
  body: "تفتح العيادة من الساعة ٩ صباحًا",
  aiModel: "claude-opus-5-5",
  inputTokens: 1200,
  outputTokens: 80,
};

// ───────────────────────────── fakes ─────────────────────────────

/** FakeDb plus in-memory versions of the two WhatsApp SQL functions the webhook calls. */
class WebhookDb extends FakeDb {
  override rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: DbError | null }> {
    if (fn !== "ingest_whatsapp_inbound" && fn !== "apply_whatsapp_status") return super.rpc(fn, args);
    this.rpcs.push({ fn, args });
    const injected = this.options.fail?.({ table: `rpc:${fn}`, action: "select", filters: [] });
    if (injected) return Promise.resolve({ data: null, error: injected });
    const data = fn === "ingest_whatsapp_inbound" ? this.ingest(args) : this.applyStatus(args);
    return Promise.resolve({ data, error: null });
  }

  rpcCalls(fn: string): Record<string, unknown>[] {
    return this.rpcs.filter((r) => r.fn === fn).map((r) => r.args);
  }

  private ingest(args: Record<string, unknown>): Row[] {
    const empty = { conversation_status: null, ai_paused: null, opted_out: null, privacy_notice_sent: null };
    if (this.table("messages").some((m) => m.wa_message_id === args.p_wa_message_id)) {
      return [{ conversation_id: null, message_id: null, is_duplicate: true, ...empty, language: null }];
    }
    const conversations = this.table("conversations");
    let conversation = conversations.find((c) => c.organization_id === args.p_org && c.customer_wa_id === args.p_wa_id);
    if (!conversation) {
      conversation = {
        id: crypto.randomUUID(),
        organization_id: args.p_org,
        channel: "whatsapp",
        customer_wa_id: args.p_wa_id,
        customer_name: args.p_customer_name,
        status: "open",
        ai_paused: false,
        language: null,
        opted_out_at: null,
        privacy_notice_sent_at: null,
      };
      conversations.push(conversation);
    }
    const id = crypto.randomUUID();
    this.table("messages").push({
      id,
      organization_id: args.p_org,
      conversation_id: conversation.id,
      direction: "inbound",
      sender: "customer",
      body: args.p_body,
      wa_message_id: args.p_wa_message_id,
      status: "received",
      error_code: null,
      created_at: args.p_received_at,
    });
    return [{
      conversation_id: conversation.id,
      message_id: id,
      is_duplicate: false,
      conversation_status: conversation.status,
      ai_paused: conversation.ai_paused,
      opted_out: conversation.opted_out_at !== null,
      privacy_notice_sent: conversation.privacy_notice_sent_at !== null,
      language: conversation.language,
    }];
  }

  private applyStatus(args: Record<string, unknown>): boolean {
    const message = this.table("messages").find((m) =>
      m.wa_message_id === args.p_wa_message_id && m.direction === "outbound"
    );
    if (!message) return false;
    message.status = args.p_status;
    if (args.p_status === "failed") message.error_code = args.p_error_code;
    return true;
  }
}

interface SetupOptions {
  integration?: Row;
  tables?: Record<string, Row[]>;
  appSecret?: string | null;
  verifyTokenHash?: string | null;
  credentials?: boolean;
  fail?: FakeDbOptions["fail"];
  clinicLanguage?: "ar" | "en";
}

async function setup(options: SetupOptions = {}): Promise<WebhookDb> {
  const integration: Row = {
    ...DEFAULTS.integration_settings!(),
    id: crypto.randomUUID(),
    organization_id: ORG,
    status: "connected",
    phone_number_id: PHONE_ID,
    waba_id: "102290129340398",
    webhook_key: KEY,
    credentials_verified_at: "2026-10-10T08:00:00.000Z",
    webhook_verified_at: "2026-10-10T08:05:00.000Z",
    ...options.integration,
  };
  const db = new WebhookDb({
    tables: {
      integration_settings: [integration],
      organizations: [
        { id: ORG, default_language: options.clinicLanguage ?? "ar" },
        { id: OTHER_ORG, default_language: "en" },
      ],
      ...options.tables,
    },
    unique: { integration_settings: ["phone_number_id", "webhook_key"], messages: ["wa_message_id"] },
    fail: options.fail,
  });
  if (options.credentials !== false) {
    await saveTestCredentials(
      db,
      integration,
      ACCESS_TOKEN,
      options.verifyTokenHash === undefined ? await sha256Hex(VERIFY_TOKEN) : options.verifyTokenHash,
      options.appSecret === undefined ? APP_SECRET : options.appSecret,
    );
  }
  return db;
}

function integrationRow(db: FakeDb): Row {
  const row = db.tables.integration_settings?.[0];
  assertExists(row);
  return row;
}

function fakePipeline(reply: (input: PipelineInput) => PipelineOutbound[] | Error = () => [ASSISTANT_REPLY]) {
  const calls: PipelineInput[] = [];
  const pipeline = (input: PipelineInput): Promise<PipelineResult> => {
    calls.push(input);
    const outbound = reply(input);
    if (outbound instanceof Error) return Promise.reject(outbound);
    return Promise.resolve({ outbound, outcome: "answered", status: "open", aiPaused: false });
  };
  return { pipeline, calls };
}

type FakePipeline = ReturnType<typeof fakePipeline>;

interface RunOptions {
  replies?: FetchReply[];
  pipeline?: FakePipeline;
  waitUntil?: (work: Promise<unknown>) => void;
}

function handler(db: FakeDb, options: RunOptions) {
  const fake = fakeFetch(...(options.replies ?? []));
  const pipeline = options.pipeline ?? fakePipeline();
  const run = handle(
    "whatsapp-webhook",
    createHandler(() => ({
      db: db.db,
      fetch: fake.fetch,
      now: () => NOW,
      pipeline: pipeline.pipeline,
      waitUntil: options.waitUntil,
    })),
    { methods: ["GET", "POST"] },
  );
  return { run, fetches: fake.calls, pipeline };
}

async function get(db: FakeDb, params: Record<string, string>, key = KEY) {
  const url = new URL(`http://localhost/whatsapp-webhook/${key}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const { run } = handler(db, {});
  const response = await run(new Request(url, { method: "GET" }));
  return { response, text: await response.text() };
}

interface PostOptions extends RunOptions {
  /** undefined: a valid signature; null: no header; a string: that header value. */
  signature?: string | null;
  key?: string;
  raw?: string;
}

async function post(db: FakeDb, payload: unknown, options: PostOptions = {}) {
  const raw = options.raw ?? JSON.stringify(payload);
  const signature = options.signature === undefined
    ? `sha256=${await hmacSha256Hex(APP_SECRET, raw)}`
    : options.signature;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature !== null) headers["x-hub-signature-256"] = signature;
  const { run, fetches, pipeline } = handler(db, options);
  const response = await run(
    new Request(`http://localhost/whatsapp-webhook/${options.key ?? KEY}`, { method: "POST", headers, body: raw }),
  );
  return { response, body: await response.json(), fetches, pipeline };
}

// ───────────────────────────── Meta payloads ─────────────────────────────

function delivery(value: Row, phoneNumberId = PHONE_ID) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "102290129340398", changes: [{ field: "messages", value: change(value, phoneNumberId) }] }],
  };
}

function change(value: Row, phoneNumberId = PHONE_ID): Row {
  return {
    messaging_product: "whatsapp",
    metadata: { display_phone_number: "966500000001", phone_number_id: phoneNumberId },
    ...value,
  };
}

function inbound(...messages: Row[]) {
  return delivery({ contacts: [{ profile: { name: CUSTOMER_NAME }, wa_id: CUSTOMER }], messages });
}

function textMessage(id: string, body: string, secondsAgo = 30, from = CUSTOMER): Row {
  return { from, id, timestamp: String(NOW_SECONDS - secondsAgo), type: "text", text: { body } };
}

function mediaMessage(id: string, type: string, secondsAgo = 30): Row {
  return {
    from: CUSTOMER,
    id,
    timestamp: String(NOW_SECONDS - secondsAgo),
    type,
    [type]: { id: "1234567890", mime_type: "image/jpeg" },
  };
}

function sentReply(wamid: string): Response {
  return jsonResponse({
    messaging_product: "whatsapp",
    contacts: [{ input: CUSTOMER, wa_id: CUSTOMER }],
    messages: [{ id: wamid }],
  });
}

function outboundRows(db: FakeDb): Row[] {
  return (db.tables.messages ?? []).filter((m) => m.direction === "outbound");
}

function conversation(db: FakeDb): Row {
  const row = db.tables.conversations?.[0];
  assertExists(row);
  return row;
}

/** Every read and write the handler made on tenant data carries this clinic's id (inserts carry it as a value). */
function assertTenantScoped(db: FakeDb, tables: string[]): void {
  for (const call of db.calls.filter((c: Call) => tables.includes(c.table))) {
    if (call.action === "insert" || call.action === "upsert") {
      const rows = Array.isArray(call.values) ? call.values : [call.values ?? {}];
      assert(rows.every((row) => row.organization_id === ORG), `insert into ${call.table} for another clinic`);
      continue;
    }
    // The webhook key lookup is the trusted lookup that establishes the clinic.
    if (call.table === "integration_settings" && call.filters.some((f) => f.column === "webhook_key")) continue;
    const scoped = call.table === "organizations"
      ? call.filters.some((f) => f.column === "id" && f.value === ORG)
      : scopedTo(call, ORG);
    assert(scoped, `unscoped ${call.action} on ${call.table}`);
  }
}

// ───────────────────────────── GET: verification handshake ─────────────────────────────

const HANDSHAKE = { "hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN, "hub.challenge": "1158201444" };

Deno.test("GET: echoes the challenge, records the verification and marks the integration connected", async () => {
  const db = await setup({ integration: { status: "credentials_verified", webhook_verified_at: null } });
  const { response, text } = await get(db, HANDSHAKE);

  assertEquals(response.status, 200);
  assertEquals(text, "1158201444");
  assertStringIncludes(response.headers.get("content-type") ?? "", "text/plain");
  const row = integrationRow(db);
  assertEquals(row.status, "connected");
  assertEquals(row.webhook_verified_at, NOW.toISOString());
  const [update] = db.callsTo("integration_settings", "update");
  assertExists(update);
  assert(scopedTo(update, ORG));
  assert(update.filters.some((f) => f.column === "id" && f.value === row.id));
  assertEquals(db.audits.map((a) => [a.action, a.org, a.entity]), [["whatsapp.webhook_verified", ORG, row.id]]);
});

Deno.test("GET: a recorded integration error is not overwritten by the handshake", async () => {
  const db = await setup({ integration: { status: "error", last_error: "Meta rejected the access token" } });
  const { response } = await get(db, HANDSHAKE);
  assertEquals(response.status, 200);
  assertEquals(integrationRow(db).status, "error");
  assertEquals(integrationRow(db).webhook_verified_at, NOW.toISOString());
});

Deno.test("GET: a wrong verify token is 403 without detail and changes nothing", async () => {
  const db = await setup({ integration: { status: "credentials_verified", webhook_verified_at: null } });
  const { response, text } = await get(db, { ...HANDSHAKE, "hub.verify_token": "not-the-token" });
  assertEquals(response.status, 403);
  const body = JSON.parse(text);
  assertEquals(body.error, "forbidden");
  assertEquals(body.details, undefined);
  assert(!text.includes("1158201444"));
  assertEquals(db.callsTo("integration_settings", "update").length, 0);
  assertEquals(integrationRow(db).status, "credentials_verified");
  assertEquals(db.audits.length, 0);
});

Deno.test("GET: a wrong mode, a missing token or a missing or oversized challenge is 403", async () => {
  const db = await setup();
  const cases: Record<string, string>[] = [
    { ...HANDSHAKE, "hub.mode": "unsubscribe" },
    { "hub.verify_token": VERIFY_TOKEN, "hub.challenge": "1158201444" },
    { "hub.mode": "subscribe", "hub.challenge": "1158201444" },
    { "hub.mode": "subscribe", "hub.verify_token": VERIFY_TOKEN },
    { ...HANDSHAKE, "hub.challenge": "1".repeat(201) },
    { ...HANDSHAKE, "hub.challenge": "<script>alert(1)</script> x" },
  ];
  for (const params of cases) {
    const { response } = await get(db, params);
    assertEquals(response.status, 403, JSON.stringify(Object.keys(params)));
  }
  assertEquals(db.callsTo("integration_settings", "update").length, 0);
});

Deno.test("GET: a malformed or unknown key is 403", async () => {
  const db = await setup();
  for (const key of ["not-a-key", KEY.toUpperCase(), `${KEY}0`, "cd".repeat(18)]) {
    const { response } = await get(db, HANDSHAKE, key);
    assertEquals(response.status, 403, key);
  }
  // Malformed keys never reach the database.
  assertEquals(db.callsTo("integration_settings", "select").length, 1);
});

Deno.test("GET: an integration without stored credentials is 403", async () => {
  const db = await setup({ credentials: false });
  const { response } = await get(db, HANDSHAKE);
  assertEquals(response.status, 403);
});

// ───────────────────────────── POST: authentication ─────────────────────────────

Deno.test("POST: an unknown or malformed key is 404", async () => {
  const db = await setup();
  for (const key of ["cd".repeat(18), "short", "whatsapp-webhook"]) {
    const { response, body, pipeline } = await post(db, inbound(textMessage("wamid.IN1", "hello")), { key });
    assertEquals(response.status, 404, key);
    assertEquals(body.error, "not_found");
    assertEquals(pipeline.calls.length, 0);
  }
  assertEquals(db.rpcCalls("ingest_whatsapp_inbound").length, 0);
});

Deno.test("POST: a missing or bad signature is 401 and nothing is processed", async () => {
  const db = await setup();
  const payload = inbound(textMessage("wamid.IN1", "hello"));
  const raw = JSON.stringify(payload);
  const signatures: (string | null)[] = [
    null,
    "",
    `sha256=${"0".repeat(64)}`,
    `sha256=${await hmacSha256Hex("some-other-app-secret", raw)}`,
    `sha256=${await hmacSha256Hex(APP_SECRET, `${raw} `)}`,
    await hmacSha256Hex(APP_SECRET, raw),
  ];
  for (const signature of signatures) {
    const { response, body, pipeline, fetches } = await post(db, payload, { signature });
    assertEquals(response.status, 401, String(signature));
    assertEquals(body.error, "unauthorized");
    assertEquals(pipeline.calls.length, 0);
    assertEquals(fetches.length, 0);
  }
  assertEquals(db.rpcCalls("ingest_whatsapp_inbound").length, 0);
  assertEquals(db.tables.messages ?? [], []);
});

Deno.test("POST: an integration without a stored app secret rejects every delivery with 401", async () => {
  const db = await setup({ appSecret: null });
  const { response } = await post(db, inbound(textMessage("wamid.IN1", "hello")));
  assertEquals(response.status, 401);
  assertEquals(db.rpcCalls("ingest_whatsapp_inbound").length, 0);
});

Deno.test("POST: a body over 1 MB is 413", async () => {
  const db = await setup();
  const raw = JSON.stringify({ object: "whatsapp_business_account", padding: "x".repeat(1024 * 1024) });
  const { response, body } = await post(db, null, { raw });
  assertEquals(response.status, 413);
  assertEquals(body.error, "payload_too_large");
});

Deno.test("POST: a correctly signed body that is not JSON is 400", async () => {
  const db = await setup();
  const { response, body } = await post(db, null, { raw: "{not json" });
  assertEquals(response.status, 400);
  assertEquals(body.error, "invalid_json");
});

// ───────────────────────────── POST: messages ─────────────────────────────

Deno.test("POST: a text message is stored, answered, and the reply recorded pending then sent with the wamid", async () => {
  const db = await setup();
  let statusAtSend: unknown[] = [];
  const { response, body, fetches, pipeline } = await post(db, inbound(textMessage("wamid.IN1", "متى تفتحون؟")), {
    replies: [(_call) => {
      statusAtSend = outboundRows(db).map((m) => m.status);
      return sentReply("wamid.OUT1");
    }],
  });

  assertEquals(response.status, 200);
  assertEquals(body, { received: true });

  assertEquals(db.rpcCalls("ingest_whatsapp_inbound"), [{
    p_org: ORG,
    p_wa_id: CUSTOMER,
    p_customer_name: CUSTOMER_NAME,
    p_wa_message_id: "wamid.IN1",
    p_body: "متى تفتحون؟",
    p_received_at: new Date((NOW_SECONDS - 30) * 1000).toISOString(),
  }]);

  const conv = conversation(db);
  assertEquals(pipeline.calls.length, 1);
  const input = pipeline.calls[0]!;
  assertEquals(
    [input.organizationId, input.conversationId, input.channel, input.text, input.customerPhone],
    [ORG, conv.id, "whatsapp", "متى تفتحون؟", `+${CUSTOMER}`],
  );

  assertEquals(fetches.length, 1);
  assertEquals(fetches[0]?.url, SEND_URL);
  assertEquals(fetches[0]?.headers.get("authorization"), `Bearer ${ACCESS_TOKEN}`);
  const sent = fetches[0]?.body as Row;
  assertEquals([sent.to, (sent.text as Row).body], [CUSTOMER, ASSISTANT_REPLY.body]);

  // The row existed as "pending" before Meta was called, and became "sent" only with Meta's id.
  assertEquals(statusAtSend, ["pending"]);
  assertEquals(db.callsTo("messages", "insert")[0]?.values, {
    organization_id: ORG,
    conversation_id: conv.id,
    direction: "outbound",
    sender: "assistant",
    body: ASSISTANT_REPLY.body,
    status: "pending",
    staff_user_id: null,
    wa_message_id: null,
    error_code: null,
    error_detail: null,
    ai_model: "claude-opus-5-5",
    input_tokens: 1200,
    output_tokens: 80,
  });
  const [reply] = outboundRows(db);
  assertEquals([reply?.status, reply?.wa_message_id, reply?.sender], ["sent", "wamid.OUT1", "assistant"]);
  assertTenantScoped(db, ["messages", "conversations", "integration_settings", "integration_credentials"]);
});

Deno.test("POST: every outbound from the pipeline is sent in order", async () => {
  const db = await setup();
  const notice: PipelineOutbound = { sender: "system", body: "Privacy notice" };
  const { fetches } = await post(db, inbound(textMessage("wamid.IN1", "hello")), {
    pipeline: fakePipeline(() => [notice, ASSISTANT_REPLY]),
    replies: [sentReply("wamid.OUT1"), sentReply("wamid.OUT2")],
  });
  assertEquals(fetches.map((f) => ((f.body as Row).text as Row).body), ["Privacy notice", ASSISTANT_REPLY.body]);
  assertEquals(
    outboundRows(db).map((m) => [m.sender, m.status, m.wa_message_id]),
    [["system", "sent", "wamid.OUT1"], ["assistant", "sent", "wamid.OUT2"]],
  );
});

Deno.test("POST: Meta's retry of the same message is not answered twice", async () => {
  const db = await setup();
  const payload = inbound(textMessage("wamid.IN1", "hello"));
  const pipeline = fakePipeline();
  const first = await post(db, payload, { pipeline, replies: [sentReply("wamid.OUT1")] });
  const retry = await post(db, payload, { pipeline, replies: [sentReply("wamid.OUT2")] });

  assertEquals([first.response.status, retry.response.status], [200, 200]);
  assertEquals(retry.body, { received: true });
  assertEquals(db.rpcCalls("ingest_whatsapp_inbound").length, 2);
  assertEquals(pipeline.calls.length, 1);
  assertEquals(retry.fetches.length, 0);
  assertEquals(outboundRows(db).length, 1);
});

Deno.test("POST: changes for another phone_number_id are ignored, the clinic's own are processed", async () => {
  const db = await setup();
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      id: "102290129340398",
      changes: [
        {
          field: "messages",
          value: change({ messages: [textMessage("wamid.FOREIGN", "not for this clinic")] }, "999999999999"),
        },
        { field: "messages", value: change({ messages: [textMessage("wamid.MINE", "hello")] }) },
      ],
    }],
  };
  const { pipeline, fetches } = await post(db, payload, { replies: [sentReply("wamid.OUT1")] });
  assertEquals(db.rpcCalls("ingest_whatsapp_inbound").map((a) => a.p_wa_message_id), ["wamid.MINE"]);
  assertEquals(pipeline.calls.map((c) => c.text), ["hello"]);
  assertEquals(fetches.length, 1);

  const foreignOnly = await setup();
  const ignored = await post(foreignOnly, delivery({ messages: [textMessage("wamid.F2", "x")] }, "999999999999"));
  assertEquals(ignored.response.status, 200);
  assertEquals(foreignOnly.rpcCalls("ingest_whatsapp_inbound").length, 0);
  assertEquals(ignored.pipeline.calls.length, 0);
});

Deno.test("POST: messages are handled oldest first and one failure does not block the next", async () => {
  const db = await setup();
  const pipeline = fakePipeline((input) =>
    input.text === "first" ? new Error("database unavailable") : [ASSISTANT_REPLY]
  );
  const { fetches } = await post(
    db,
    inbound(textMessage("wamid.NEW", "second", 10), textMessage("wamid.OLD", "first", 50)),
    { pipeline, replies: [sentReply("wamid.OUT1")] },
  );
  assertEquals(pipeline.calls.map((c) => c.text), ["first", "second"]);
  assertEquals(fetches.length, 1);
  // The message that could not be answered is handed to reception.
  assertEquals(conversation(db).status, "awaiting_human");
  assertTenantScoped(db, ["conversations", "messages"]);
});

Deno.test("POST: a message older than the 24-hour window is stored but not answered", async () => {
  const db = await setup();
  const { pipeline, fetches } = await post(db, inbound(textMessage("wamid.LATE", "hello", 25 * 3600)));
  assertEquals(db.rpcCalls("ingest_whatsapp_inbound").length, 1);
  assertEquals(pipeline.calls.length, 0);
  assertEquals(fetches.length, 0);
  assertEquals(conversation(db).status, "awaiting_human");
});

Deno.test("POST: a send failure is recorded as failed with Meta's code and leaves the integration alone", async () => {
  const db = await setup();
  await post(db, inbound(textMessage("wamid.IN1", "hello")), {
    replies: [metaError(131026, "Message undeliverable", 400)],
  });
  const [reply] = outboundRows(db);
  assertEquals([reply?.status, reply?.error_code, reply?.wa_message_id], ["failed", "131026", null]);
  assertStringIncludes(String(reply?.error_detail), "cannot receive");
  assertEquals(integrationRow(db).status, "connected");
  assertEquals(db.callsTo("integration_settings", "update").length, 0);
});

Deno.test("POST: an auth failure marks every reply failed and flags the integration once", async () => {
  const db = await setup();
  await post(db, inbound(textMessage("wamid.IN1", "hello")), {
    pipeline: fakePipeline(() => [{ sender: "system", body: "Privacy notice" }, ASSISTANT_REPLY]),
    replies: [
      metaError(190, "Error validating access token: Session has expired", 401),
      metaError(190, "Error validating access token: Session has expired", 401),
    ],
  });
  assertEquals(outboundRows(db).map((m) => [m.status, m.error_code]), [["failed", "190"], ["failed", "190"]]);
  const row = integrationRow(db);
  assertEquals(row.status, "error");
  assertStringIncludes(String(row.last_error), "access token");
  assertEquals(row.last_error_at, NOW.toISOString());
  const updates = db.callsTo("integration_settings", "update");
  assertEquals(updates.length, 1);
  assert(scopedTo(updates[0]!, ORG));
});

Deno.test("POST: a network failure is recorded as failed, never as sent", async () => {
  const db = await setup();
  await post(db, inbound(textMessage("wamid.IN1", "hello")), { replies: [new TypeError("connection reset")] });
  const [reply] = outboundRows(db);
  assertEquals([reply?.status, reply?.error_code], ["failed", "network_error"]);
});

// ───────────────────────────── POST: messages without text ─────────────────────────────

Deno.test("POST: an image is stored as [image] and answered once with the type-your-question notice", async () => {
  const db = await setup({ clinicLanguage: "en" });
  const first = await post(db, inbound(mediaMessage("wamid.IMG1", "image"), mediaMessage("wamid.IMG2", "image", 20)), {
    replies: [sentReply("wamid.NOTICE")],
  });
  assertEquals(db.rpcCalls("ingest_whatsapp_inbound").map((a) => a.p_body), ["[image]", "[image]"]);
  assertEquals(first.pipeline.calls.length, 0);
  assertEquals(first.fetches.length, 1);
  assertEquals(((first.fetches[0]?.body as Row).text as Row).body, typeQuestionNotice("en"));
  assertEquals(outboundRows(db).map((m) => [m.sender, m.status]), [["system", "sent"]]);

  // A later voice note in another delivery does not repeat the notice.
  const second = await post(db, inbound(mediaMessage("wamid.AUD1", "audio", 5)));
  assertEquals(second.fetches.length, 0);
  assertEquals(db.rpcCalls("ingest_whatsapp_inbound").length, 3);
  assertTenantScoped(db, ["messages", "organizations"]);
});

Deno.test("POST: the notice follows the conversation's language over the clinic default", async () => {
  const db = await setup({
    clinicLanguage: "en",
    tables: {
      conversations: [{
        id: "30000000-0000-4000-8000-000000000001",
        organization_id: ORG,
        channel: "whatsapp",
        customer_wa_id: CUSTOMER,
        status: "open",
        ai_paused: false,
        language: "ar",
        opted_out_at: null,
        privacy_notice_sent_at: null,
      }],
    },
  });
  const { fetches } = await post(db, inbound(mediaMessage("wamid.IMG1", "sticker")), {
    replies: [sentReply("wamid.NOTICE")],
  });
  assertEquals(((fetches[0]?.body as Row).text as Row).body, typeQuestionNotice("ar"));
});

Deno.test("POST: no notice for an opted-out or paused conversation, or for a reaction", async () => {
  const base = {
    organization_id: ORG,
    channel: "whatsapp",
    customer_wa_id: CUSTOMER,
    status: "open",
    language: null,
    privacy_notice_sent_at: null,
  };
  const variants: Row[] = [
    { ...base, id: crypto.randomUUID(), ai_paused: false, opted_out_at: "2026-10-01T00:00:00.000Z" },
    { ...base, id: crypto.randomUUID(), ai_paused: true, opted_out_at: null },
  ];
  for (const row of variants) {
    const db = await setup({ tables: { conversations: [row] } });
    const { fetches, pipeline } = await post(db, inbound(mediaMessage("wamid.IMG1", "image")));
    assertEquals(db.rpcCalls("ingest_whatsapp_inbound").length, 1);
    assertEquals([fetches.length, pipeline.calls.length], [0, 0]);
  }
  const db = await setup();
  const reaction = {
    from: CUSTOMER,
    id: "wamid.R1",
    timestamp: String(NOW_SECONDS - 5),
    type: "reaction",
    reaction: { message_id: "wamid.OUT1", emoji: "👍" },
  };
  const { fetches } = await post(db, inbound(reaction));
  assertEquals(db.rpcCalls("ingest_whatsapp_inbound").map((a) => a.p_body), ["[reaction]"]);
  assertEquals(fetches.length, 0);
});

// ───────────────────────────── POST: delivery receipts ─────────────────────────────

Deno.test("POST: delivery receipts are forwarded to apply_whatsapp_status for this clinic's messages only", async () => {
  const sent = (organizationId: string, wamid: string): Row => ({
    id: crypto.randomUUID(),
    organization_id: organizationId,
    conversation_id: crypto.randomUUID(),
    direction: "outbound",
    sender: "assistant",
    body: "x",
    status: "sent",
    wa_message_id: wamid,
    error_code: null,
  });
  const db = await setup({
    tables: { messages: [sent(ORG, "wamid.OUT9"), sent(ORG, "wamid.OUT8"), sent(OTHER_ORG, "wamid.THEIRS")] },
  });
  const ts = String(NOW_SECONDS - 5);
  const { response, pipeline } = await post(
    db,
    delivery({
      statuses: [
        { id: "wamid.OUT9", status: "read", timestamp: ts, recipient_id: CUSTOMER },
        {
          id: "wamid.OUT8",
          status: "failed",
          timestamp: ts,
          recipient_id: CUSTOMER,
          errors: [{
            code: 131047,
            title: "Re-engagement message",
            message: "Re-engagement message",
            error_data: { details: "More than 24 hours have passed since the customer last replied." },
          }],
        },
        { id: "wamid.THEIRS", status: "read", timestamp: ts, recipient_id: "966500000099" },
      ],
    }),
  );
  assertEquals(response.status, 200);
  assertEquals(pipeline.calls.length, 0);
  assertEquals(db.rpcCalls("apply_whatsapp_status"), [
    { p_wa_message_id: "wamid.OUT9", p_status: "read", p_error_code: null, p_error_detail: null },
    {
      p_wa_message_id: "wamid.OUT8",
      p_status: "failed",
      p_error_code: "131047",
      p_error_detail: "Re-engagement message: More than 24 hours have passed since the customer last replied.",
    },
  ]);
  const byWamid = Object.fromEntries((db.tables.messages ?? []).map((m) => [m.wa_message_id, m.status]));
  assertEquals(byWamid, { "wamid.OUT9": "read", "wamid.OUT8": "failed", "wamid.THEIRS": "sent" });
  assertTenantScoped(db, ["messages"]);
});

Deno.test("POST: a failing status update does not stop the messages in the same delivery", async () => {
  const db = await setup({
    tables: {
      messages: [{
        id: crypto.randomUUID(),
        organization_id: ORG,
        conversation_id: crypto.randomUUID(),
        direction: "outbound",
        status: "sent",
        wa_message_id: "wamid.OUT9",
      }],
    },
    fail: (call) => call.table === "rpc:apply_whatsapp_status" ? { code: "XX000", message: "boom" } : null,
  });
  const payload = delivery({
    contacts: [{ profile: { name: CUSTOMER_NAME }, wa_id: CUSTOMER }],
    statuses: [{ id: "wamid.OUT9", status: "delivered", timestamp: String(NOW_SECONDS - 5) }],
    messages: [textMessage("wamid.IN1", "hello")],
  });
  const { response, pipeline } = await post(db, payload, { replies: [sentReply("wamid.OUT1")] });
  assertEquals(response.status, 200);
  assertEquals(pipeline.calls.length, 1);
});

// ───────────────────────────── background processing and logs ─────────────────────────────

Deno.test("POST: with waitUntil, Meta gets its 200 before the reply is generated", async () => {
  const db = await setup();
  const gate = Promise.withResolvers<void>();
  const calls: PipelineInput[] = [];
  const slowPipeline: FakePipeline = {
    calls,
    pipeline: async (input) => {
      calls.push(input);
      await gate.promise;
      return { outbound: [ASSISTANT_REPLY], outcome: "answered", status: "open", aiPaused: false };
    },
  };
  let scheduled: Promise<unknown> | undefined;
  const { response, body, fetches } = await post(db, inbound(textMessage("wamid.IN1", "hello")), {
    pipeline: slowPipeline,
    waitUntil: (work) => {
      scheduled = work;
    },
    replies: [sentReply("wamid.OUT1")],
  });
  assertEquals([response.status, body], [200, { received: true }]);
  assertExists(scheduled);
  assertEquals(fetches.length, 0);

  gate.resolve();
  await scheduled;
  assertEquals(fetches.length, 1);
  assertEquals(outboundRows(db)[0]?.status, "sent");
});

Deno.test("logs never contain message text, names, phone numbers, wamids or secrets", async () => {
  const lines: string[] = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  const capture = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  console.log = capture;
  console.warn = capture;
  console.error = capture;
  try {
    const db = await setup();
    await post(db, inbound(textMessage("wamid.SECRETID", "my private question")), {
      replies: [metaError(190, "Invalid OAuth access token", 401)],
    });
    await post(db, inbound(mediaMessage("wamid.IMGSECRET", "image")), { replies: [sentReply("wamid.OUTSECRET")] });
    await post(db, inbound(textMessage("wamid.X", "bad")), { signature: `sha256=${"0".repeat(64)}` });
    await get(db, { ...HANDSHAKE, "hub.verify_token": "wrong-token-value" });
  } finally {
    Object.assign(console, original);
  }
  assert(lines.length > 0);
  const output = lines.join("\n");
  for (
    const forbidden of [
      "my private question",
      CUSTOMER,
      CUSTOMER_NAME,
      "wamid.",
      ACCESS_TOKEN,
      APP_SECRET,
      VERIFY_TOKEN,
      "wrong-token-value",
      ASSISTANT_REPLY.body,
    ]
  ) {
    assert(!output.includes(forbidden), `log output contains ${forbidden}`);
  }
});
