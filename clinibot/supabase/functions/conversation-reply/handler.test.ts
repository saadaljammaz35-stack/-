import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { handle } from "../_shared/http.ts";
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
} from "../_shared/whatsapp/testing.ts";
import { createHandler } from "./handler.ts";

setTestEnv();

const NOW = new Date("2026-10-12T09:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const ORG = "00000000-0000-4000-8000-00000000000a";
const OTHER_ORG = "00000000-0000-4000-8000-00000000000b";
const TOKEN = "EAAGreplyTOKEN0123456789abcdef";

const IDS = {
  web: "10000000-0000-4000-8000-000000000001",
  wa: "10000000-0000-4000-8000-000000000002",
  waOld: "10000000-0000-4000-8000-000000000003",
  waStop: "10000000-0000-4000-8000-000000000004",
  foreign: "10000000-0000-4000-8000-000000000005",
  missing: "10000000-0000-4000-8000-000000000099",
};

function conversation(id: string, organizationId: string, extra: Row = {}): Row {
  return {
    id,
    organization_id: organizationId,
    channel: "whatsapp",
    status: "open",
    customer_wa_id: "966512345678",
    web_session_hash: null,
    opted_out_at: null,
    last_inbound_at: new Date(NOW.getTime() - HOUR).toISOString(),
    ai_paused: false,
    assigned_to: null,
    ...extra,
  };
}

const INTEGRATION: Row = {
  ...DEFAULTS.integration_settings!(),
  id: "20000000-0000-4000-8000-000000000001",
  organization_id: ORG,
  status: "connected",
  phone_number_id: "106540352242922",
  waba_id: "102290129340398",
};

async function setup(options: { integration?: Row | null; credentials?: boolean } = {}): Promise<FakeDb> {
  const integration = options.integration === undefined ? INTEGRATION : options.integration;
  const db = new FakeDb({
    tables: {
      organization_members: [
        { organization_id: ORG, user_id: "user-owner", role: "owner" },
        { organization_id: ORG, user_id: "user-recep", role: "receptionist" },
        { organization_id: OTHER_ORG, user_id: "user-other", role: "owner" },
      ],
      conversations: [
        conversation(IDS.web, ORG, {
          channel: "web",
          customer_wa_id: null,
          web_session_hash: "a".repeat(64),
          status: "awaiting_human",
          last_inbound_at: new Date(NOW.getTime() - 72 * HOUR).toISOString(),
        }),
        conversation(IDS.wa, ORG),
        conversation(IDS.waOld, ORG, { last_inbound_at: new Date(NOW.getTime() - 25 * HOUR).toISOString() }),
        conversation(IDS.waStop, ORG, { opted_out_at: new Date(NOW.getTime() - HOUR).toISOString() }),
        conversation(IDS.foreign, OTHER_ORG),
      ],
      integration_settings: integration ? [integration] : [],
    },
    users: { "token-owner": "user-owner", "token-recep": "user-recep", "token-other": "user-other" },
  });
  if (integration && options.credentials !== false) await saveTestCredentials(db, integration, TOKEN);
  return db;
}

async function call(db: FakeDb, body: unknown, replies: FetchReply[] = [], token = "token-recep") {
  const fake = fakeFetch(...replies);
  const response = await handle(
    "conversation-reply",
    createHandler(() => ({ db: db.db, fetch: fake.fetch, now: () => NOW })),
  )(staffRequest(body, token));
  return { response, body: await response.json(), fetches: fake.calls };
}

function conv(db: FakeDb, id: string): Row {
  return db.tables.conversations!.find((c) => c.id === id)!;
}

const sent = (id = "wamid.OK") => jsonResponse({ messaging_product: "whatsapp", messages: [{ id }] });

Deno.test("web: a receptionist's reply is stored as sent and the conversation is handed to them", async () => {
  const db = await setup();
  const { response, body, fetches } = await call(db, { conversation_id: IDS.web, body: "  أهلاً، معك الاستقبال  " });
  assertEquals(response.status, 200);
  assertEquals(fetches.length, 0);
  assertEquals(body.message.direction, "outbound");
  assertEquals(body.message.sender, "staff");
  assertEquals(body.message.body, "أهلاً، معك الاستقبال");
  assertEquals(body.message.status, "sent");
  assertEquals(body.message.error_code, null);
  const stored = db.tables.messages![0]!;
  assertEquals([stored.organization_id, stored.conversation_id, stored.staff_user_id], [ORG, IDS.web, "user-recep"]);
  const c = conv(db, IDS.web);
  assertEquals([c.ai_paused, c.assigned_to, c.status], [true, "user-recep", "open"]);
  assertEquals(db.audits.map((a) => [a.action, a.entity]), [["conversation.staff_reply", IDS.web]]);
  assertEquals(JSON.stringify(db.audits).includes("الاستقبال"), false);
  for (const update of db.callsTo("conversations", "update")) assert(scopedTo(update, ORG));
});

Deno.test("web: templates are rejected", async () => {
  const db = await setup();
  const { response, body } = await call(db, {
    conversation_id: IDS.web,
    template: { name: "follow_up", language: "ar", body_params: [] },
  });
  assertEquals(response.status, 400);
  assertEquals(body.error, "invalid_request");
  assertEquals(db.tables.messages ?? [], []);
});

Deno.test("unknown and other clinics' conversations get the same 404", async () => {
  const db = await setup();
  const missing = await call(db, { conversation_id: IDS.missing, body: "hi" });
  const foreign = await call(db, { conversation_id: IDS.foreign, body: "hi" });
  assertEquals([missing.response.status, foreign.response.status], [404, 404]);
  assertEquals([missing.body.error, foreign.body.error], ["not_found", "not_found"]);
  assertEquals(missing.body.message, foreign.body.message);
  assertEquals(foreign.fetches.length, 0);
  assertEquals(db.tables.messages ?? [], []);
  assertEquals(conv(db, IDS.foreign).ai_paused, false);
});

Deno.test("whatsapp: inside the window the reply is sent and stored with Meta's id", async () => {
  const db = await setup();
  const { response, body, fetches } = await call(db, { conversation_id: IDS.wa, body: "تم حجز موعدك" }, [
    sent("wamid.HBgMOTY2"),
  ]);
  assertEquals(response.status, 200);
  assertEquals([body.message.status, body.message.error_code, body.message.body], ["sent", null, "تم حجز موعدك"]);
  assertEquals(fetches.length, 1);
  assertEquals(fetches[0]?.url, "https://graph.facebook.com/v26.0/106540352242922/messages");
  assertEquals(fetches[0]?.headers.get("authorization"), `Bearer ${TOKEN}`);
  assertEquals(fetches[0]?.body, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "966512345678",
    type: "text",
    text: { preview_url: false, body: "تم حجز موعدك" },
  });
  const stored = db.tables.messages![0]!;
  assertEquals([stored.status, stored.wa_message_id, stored.organization_id], ["sent", "wamid.HBgMOTY2", ORG]);
  for (const update of db.callsTo("messages", "update")) assert(scopedTo(update, ORG));
});

Deno.test("whatsapp: the message is stored as pending before Meta is called", async () => {
  const db = await setup();
  let statusDuringSend: unknown;
  await call(db, { conversation_id: IDS.wa, body: "hello" }, [() => {
    statusDuringSend = db.tables.messages?.[0]?.status;
    return sent();
  }]);
  assertEquals(statusDuringSend, "pending");
});

Deno.test("whatsapp: free text outside 24 hours is refused before anything is stored or sent", async () => {
  const db = await setup();
  const { response, body, fetches } = await call(db, { conversation_id: IDS.waOld, body: "hello" });
  assertEquals(response.status, 409);
  assertEquals(body.error, "outside_service_window");
  assertEquals(fetches.length, 0);
  assertEquals(db.tables.messages ?? [], []);
  assertEquals(conv(db, IDS.waOld).ai_paused, false);
});

Deno.test("whatsapp: an approved template may be sent outside the window", async () => {
  const db = await setup();
  const { response, body, fetches } = await call(db, {
    conversation_id: IDS.waOld,
    template: { name: "follow_up", language: "ar", body_params: ["سارة"] },
  }, [sent("wamid.TPL")]);
  assertEquals(response.status, 200);
  assertEquals(body.message.status, "sent");
  assertEquals(body.message.body, "[template follow_up (ar)] سارة");
  assertEquals(fetches[0]?.body, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "966512345678",
    type: "template",
    template: {
      name: "follow_up",
      language: { code: "ar" },
      components: [{ type: "body", parameters: [{ type: "text", text: "سارة" }] }],
    },
  });
});

Deno.test("whatsapp: an opted-out customer is not messaged", async () => {
  const db = await setup();
  const { response, body, fetches } = await call(db, {
    conversation_id: IDS.waStop,
    template: { name: "follow_up", language: "ar" },
  });
  assertEquals(response.status, 409);
  assertEquals(body.error, "customer_opted_out");
  assertEquals(fetches.length, 0);
});

Deno.test("whatsapp: no integration, a disconnected or errored one, or missing credentials → whatsapp_not_connected", async () => {
  for (
    const db of [
      await setup({ integration: null }),
      await setup({ integration: { ...INTEGRATION, status: "disconnected" } }),
      await setup({ integration: { ...INTEGRATION, status: "error" } }),
      await setup({ credentials: false }),
    ]
  ) {
    const { response, body, fetches } = await call(db, { conversation_id: IDS.wa, body: "hello" });
    assertEquals(response.status, 409);
    assertEquals(body.error, "whatsapp_not_connected");
    assertEquals(fetches.length, 0);
    assertEquals(db.tables.messages ?? [], []);
  }
});

Deno.test("whatsapp: credentials_verified (handshake pending) can already send", async () => {
  const db = await setup({ integration: { ...INTEGRATION, status: "credentials_verified" } });
  const { body } = await call(db, { conversation_id: IDS.wa, body: "hello" }, [sent()]);
  assertEquals(body.message.status, "sent");
});

Deno.test("whatsapp: Meta refusing the message is reported as failed, never as sent", async () => {
  const db = await setup();
  const { response, body } = await call(db, { conversation_id: IDS.wa, body: "hello" }, [
    metaError(131047, "Re-engagement message", 400, "More than 24 hours have passed"),
  ]);
  assertEquals(response.status, 200);
  assertEquals([body.message.status, body.message.error_code], ["failed", "131047"]);
  const stored = db.tables.messages![0]!;
  assertEquals([stored.status, stored.wa_message_id, stored.error_code], ["failed", null, "131047"]);
  assert(String(stored.error_detail).includes("24-hour"));
  assertEquals(db.tables.integration_settings![0]!.status, "connected");
  assertEquals(db.audits[0]?.details.status, "failed");
});

Deno.test("whatsapp: an expired token fails the message and marks the integration as error", async () => {
  const db = await setup();
  const { response, body } = await call(db, { conversation_id: IDS.wa, body: "hello" }, [
    metaError(190, "Error validating access token: Session has expired.", 401),
  ]);
  assertEquals(response.status, 200);
  assertEquals([body.message.status, body.message.error_code], ["failed", "190"]);
  const integration = db.tables.integration_settings![0]!;
  assertEquals(integration.status, "error");
  assert(String(integration.last_error).includes("access token"));
  assertEquals(String(integration.last_error).includes(TOKEN), false);
  assertEquals(integration.last_error_at, NOW.toISOString());
  for (const update of db.callsTo("integration_settings", "update")) assert(scopedTo(update, ORG));
});

Deno.test("whatsapp: a timeout is a failed message with network_error", async () => {
  const db = await setup();
  const { body } = await call(db, { conversation_id: IDS.wa, body: "hello" }, [
    new DOMException("Signal timed out.", "TimeoutError"),
  ]);
  assertEquals([body.message.status, body.message.error_code], ["failed", "network_error"]);
  assertEquals(db.tables.integration_settings![0]!.status, "connected");
});

Deno.test("pause_ai false leaves the assistant running; an existing assignee is kept", async () => {
  const db = await setup();
  conv(db, IDS.wa).assigned_to = "user-owner";
  await call(db, { conversation_id: IDS.wa, body: "hello", pause_ai: false }, [sent("wamid.1")]);
  assertEquals([conv(db, IDS.wa).ai_paused, conv(db, IDS.wa).assigned_to], [false, "user-owner"]);
  await call(db, { conversation_id: IDS.wa, body: "hello" }, [sent("wamid.2")]);
  assertEquals([conv(db, IDS.wa).ai_paused, conv(db, IDS.wa).assigned_to], [true, "user-owner"]);
});

Deno.test("exactly one of body or template, within limits", async () => {
  const db = await setup();
  for (
    const bad of [
      { conversation_id: IDS.wa },
      { conversation_id: IDS.wa, body: "x", template: { name: "a", language: "ar" } },
      { conversation_id: IDS.wa, body: "   " },
      { conversation_id: IDS.wa, body: "x".repeat(4097) },
      { conversation_id: IDS.wa, template: { name: "Bad Name", language: "ar" } },
      { conversation_id: "nope", body: "x" },
    ]
  ) {
    const { response, body } = await call(db, bad);
    assertEquals(response.status, 400, JSON.stringify(bad).slice(0, 80));
    assertEquals(body.error, "invalid_request");
  }
  assertEquals(db.tables.messages ?? [], []);
});

Deno.test("rate limited per user, before the conversation is read", async () => {
  const db = new FakeDb({ users: { "token-recep": "user-recep" }, rateLimited: true });
  const { response } = await call(db, { conversation_id: IDS.wa, body: "hello" });
  assertEquals(response.status, 429);
  assertEquals(db.rpcs[0]?.args.p_key, "reply:user:user-recep");
  assertEquals(db.callsTo("conversations").length, 0);
});

Deno.test("no session is 401", async () => {
  const db = await setup();
  const { response } = await call(db, { conversation_id: IDS.wa, body: "hello" }, [], "token-nobody");
  assertEquals(response.status, 401);
});
