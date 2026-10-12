import { assert, assertEquals, assertMatch, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { sha256Hex } from "../_shared/crypto.ts";
import { handle } from "../_shared/http.ts";
import { FakeClaude, hasFilter, message, type Row, text } from "../_shared/assistant/fakes.ts";
import { clinicDb, CONV, ORG, OTHER_ORG, type SeedOptions } from "../_shared/assistant/fixtures.ts";
import type { PipelineInput, PipelineResult } from "../_shared/assistant/pipeline.ts";
import { createPublicChatHandler, type PublicChatDeps } from "./handler.ts";

Deno.env.set("ANTHROPIC_API_KEY", "sk-ant-test-key");

const NOW = new Date("2026-10-12T09:00:00.000Z");
const IP = "203.0.113.5";
// The visitor's token for the fixture conversation CONV; only its hash is in the database.
const TOKEN = "visitor-token-0123456789abcdefghijklmnopqrstuv";

async function setup(seed: SeedOptions = {}, deps: Partial<PublicChatDeps> = {}) {
  const clinic = clinicDb({
    ...seed,
    conversation: { web_session_hash: await sha256Hex(TOKEN), ...seed.conversation },
  });
  const handler = handle(
    "public-chat",
    createPublicChatHandler({ db: () => clinic.db.asDb(), now: () => NOW, ...deps }),
  );
  const call = async (body: unknown) => {
    const response = await handler(
      new Request("http://localhost/functions/v1/public-chat", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": IP },
        body: JSON.stringify(body),
      }),
    );
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  };
  return { ...clinic, call };
}

function rateKeys(db: { rpcs: Array<{ name: string; params: Record<string, unknown> }> }): string[] {
  return db.rpcs.filter((r) => r.name === "consume_rate_limit").map((r) => String(r.params.p_key));
}

Deno.test("profile: public details of a clinic with public chat on", async () => {
  const s = await setup();
  const { status, body } = await s.call({ action: "profile", slug: "smile" });
  assertEquals(status, 200);
  const clinic = body.clinic as Record<string, unknown>;
  assertEquals(clinic.name, "عيادة الابتسامة");
  assertEquals(clinic.slug, "smile");
  assertEquals(clinic.assistant_name, "Noura");
  assertEquals(clinic.reception_phone, "+966112345678");
  assertEquals(clinic.emergency_number, "997");
  assertEquals(clinic.default_language, "ar");
  assertEquals(clinic.assistant_available, true);
  const notice = clinic.privacy_notice as Record<string, string>;
  assertStringIncludes(notice.ar!, "180");
  assertStringIncludes(notice.en!, "DELETE MY DATA");
  const welcome = clinic.welcome_message as Record<string, string>;
  assertStringIncludes(welcome.en!, "Smile Clinic");

  const off = await setup({ settings: { assistant_enabled: false } });
  const offBody = (await off.call({ action: "profile", slug: "smile" })).body.clinic as Record<string, unknown>;
  assertEquals(offBody.assistant_available, false);
});

Deno.test("profile: unknown slug and chat switched off are the same 404", async () => {
  const s = await setup({ settings: { public_chat_enabled: false } });
  for (const slug of ["smile", "no-such-clinic"]) {
    const { status, body } = await s.call({ action: "profile", slug });
    assertEquals(status, 404, slug);
    assertEquals(body.error, "not_found");
  }
  // The other clinic has public chat on in the fixtures, but its settings were never read for this slug.
  const settingsQueries = s.db.on("clinic_settings");
  assert(settingsQueries.every((q) => hasFilter(q, "organization_id", ORG)));
  assert(settingsQueries.every((q) => hasFilter(q, "public_chat_enabled", true)));
});

Deno.test("start: consent required; the raw session token is returned once and never stored", async () => {
  const s = await setup();
  const refused = await s.call({ action: "start", slug: "smile", consent: false });
  assertEquals(refused.status, 400);
  assertEquals(refused.body.error, "invalid_request");

  const { status, body } = await s.call({ action: "start", slug: "smile", consent: true, language: "en" });
  assertEquals(status, 200);
  const token = String(body.session_token);
  assertMatch(token, /^[A-Za-z0-9_-]{43}$/);

  const [insert] = s.db.on("conversations", "insert");
  const values = insert!.values as Row;
  assertEquals(values.organization_id, ORG);
  assertEquals(values.channel, "web");
  assertEquals(values.web_session_hash, await sha256Hex(token));
  assertEquals(values.language, "en");
  assertEquals(values.consent_at, NOW.toISOString());
  assertEquals(values.privacy_notice_sent_at, NOW.toISOString());
  for (const recorded of [s.db.queries, s.db.rpcs, s.tables]) {
    assert(!JSON.stringify(recorded).includes(token), "raw token reached the database");
  }

  const messages = body.messages as Array<Record<string, unknown>>;
  assertEquals(messages.length, 1);
  assertEquals(messages[0]!.direction, "outbound");
  assertEquals(messages[0]!.sender, "system");
  assertStringIncludes(String(messages[0]!.body), "Welcome to Smile Clinic");
  assertEquals(Object.keys(messages[0]!).sort(), ["body", "created_at", "direction", "id", "sender"]);

  const keys = rateKeys(s.db);
  assertEquals(keys.length, 1);
  assert(keys[0]!.startsWith("chat-start:"));
  assert(!keys[0]!.includes(IP));
});

Deno.test("start: uses the clinic's own welcome text and is limited per IP", async () => {
  const s = await setup({ settings: { welcome_message_ar: "أهلًا بك في عيادتنا" } });
  const { body } = await s.call({ action: "start", slug: "smile", consent: true });
  assertEquals((body.messages as Array<Record<string, unknown>>)[0]!.body, "أهلًا بك في عيادتنا");

  s.rpc.rateLimited.add("chat-start:");
  const limited = await s.call({ action: "start", slug: "smile", consent: true });
  assertEquals(limited.status, 429);
  assertEquals(limited.body.error, "rate_limited");
});

Deno.test("send: stores the message, runs the assistant, stores and returns the replies", async () => {
  const claude = new FakeClaude([message("end_turn", [text("سعر تنظيف الأسنان 250 ريال.")])]);
  const s = await setup({}, { pipelineDeps: { messagesClient: claude, now: () => NOW } });
  const { status, body } = await s.call({ action: "send", session_token: TOKEN, message: "كم سعر تنظيف الأسنان؟" });

  assertEquals(status, 200);
  assertEquals(body.status, "open");
  assertEquals(body.ai_paused, false);
  const messages = body.messages as Array<Record<string, unknown>>;
  assertEquals(messages.map((m) => [m.direction, m.sender, m.body]), [
    ["outbound", "assistant", "سعر تنظيف الأسنان 250 ريال."],
  ]);

  const [inbound, outbound] = s.db.on("messages", "insert").map((q) => q.values as Row);
  assertEquals(inbound, {
    organization_id: ORG,
    conversation_id: CONV,
    direction: "inbound",
    sender: "customer",
    body: "كم سعر تنظيف الأسنان؟",
    status: "received",
  });
  assertEquals(outbound!.status, "sent");
  assertEquals(outbound!.sender, "assistant");
  assertEquals(outbound!.ai_model, "claude-opus-5-5");
  assertEquals(outbound!.organization_id, ORG);

  const tokenHash = await sha256Hex(TOKEN);
  const keys = rateKeys(s.db);
  assert(keys.includes(`chat-send:session:${tokenHash}`));
  assert(keys.some((key) => key.startsWith("chat-send:ip:") && !key.includes(IP)));
  for (const recorded of [s.db.queries, s.db.rpcs]) assert(!JSON.stringify(recorded).includes(TOKEN));
  const [lookup] = s.db.on("conversations", "select");
  assert(hasFilter(lookup!, "web_session_hash", tokenHash));
});

Deno.test("send: the clinic comes from the visitor's conversation, never from the request", async () => {
  const calls: PipelineInput[] = [];
  const pipeline = (input: PipelineInput): Promise<PipelineResult> => {
    calls.push(input);
    return Promise.resolve({ outbound: [], outcome: "paused", status: "awaiting_human", aiPaused: true });
  };
  const s = await setup({}, { pipeline });
  const { status, body } = await s.call({
    action: "send",
    session_token: TOKEN,
    message: "hello",
    organization_id: OTHER_ORG,
  });
  assertEquals(status, 200);
  assertEquals(body, { messages: [], status: "awaiting_human", ai_paused: true });
  assertEquals(calls.length, 1);
  assertEquals(calls[0]!.organizationId, ORG);
  assertEquals(calls[0]!.conversationId, CONV);
  assertEquals(calls[0]!.channel, "web");
  assertEquals(calls[0]!.customerPhone, null);
});

Deno.test("send: unknown token is 404; message length and rate limits are enforced", async () => {
  const calls: PipelineInput[] = [];
  const s = await setup({}, {
    pipeline: (input) => {
      calls.push(input);
      return Promise.resolve({ outbound: [], outcome: "paused", status: "open", aiPaused: true });
    },
  });
  const unknown = await s.call({ action: "send", session_token: "A".repeat(43), message: "hi" });
  assertEquals(unknown.status, 404);
  assertEquals(unknown.body.error, "not_found");

  for (const text of ["", "   ", "x".repeat(1001)]) {
    const invalid = await s.call({ action: "send", session_token: TOKEN, message: text });
    assertEquals(invalid.status, 400, `length ${text.length}`);
  }

  s.rpc.rateLimited.add("chat-send:session:");
  const limited = await s.call({ action: "send", session_token: TOKEN, message: "hi" });
  assertEquals(limited.status, 429);
  assertEquals(s.db.on("messages", "insert").length, 0);
  assertEquals(calls.length, 0);
});

Deno.test("poll: this conversation's messages in both directions, oldest first, optionally after a time", async () => {
  const s = await setup({
    messages: [
      {
        organization_id: ORG,
        conversation_id: CONV,
        direction: "outbound",
        sender: "system",
        body: "welcome",
        status: "sent",
        created_at: "2026-10-12T08:00:00.000Z",
        error_code: null,
      },
      {
        organization_id: ORG,
        conversation_id: CONV,
        direction: "inbound",
        sender: "customer",
        body: "hi",
        status: "received",
        created_at: "2026-10-12T08:01:00.000Z",
        error_code: null,
      },
      {
        organization_id: ORG,
        conversation_id: CONV,
        direction: "outbound",
        sender: "staff",
        body: "Hello from reception",
        status: "sent",
        created_at: "2026-10-12T08:05:00.000Z",
        error_code: null,
      },
    ].map((m) => ({ id: crypto.randomUUID(), ...m })),
  });
  const all = await s.call({ action: "poll", session_token: TOKEN });
  assertEquals(all.status, 200);
  assertEquals((all.body.messages as Array<Record<string, unknown>>).map((m) => m.body), [
    "welcome",
    "hi",
    "Hello from reception",
  ]);
  assertEquals(all.body.status, "open");
  assertEquals(all.body.ai_paused, false);

  const later = await s.call({ action: "poll", session_token: TOKEN, after: "2026-10-12T11:01:00+03:00" });
  assertEquals((later.body.messages as Array<Record<string, unknown>>).map((m) => m.body), ["Hello from reception"]);

  for (const query of s.db.on("messages", "select")) {
    assert(hasFilter(query, "organization_id", ORG));
    assert(hasFilter(query, "conversation_id", CONV));
  }
  assertEquals((await s.call({ action: "poll", session_token: TOKEN, after: "yesterday" })).status, 400);
  assert(rateKeys(s.db).every((key) => key.startsWith("chat-poll:session:")));
});

Deno.test("delete: removes the visitor's conversation, audited without personal data", async () => {
  const s = await setup({ conversation: { customer_name: "Sara" } });
  const { status, body } = await s.call({ action: "delete", session_token: TOKEN });
  assertEquals(status, 200);
  assertEquals(body, { deleted: true });

  const [remove] = s.db.on("conversations", "delete");
  assert(hasFilter(remove!, "id", CONV));
  assert(hasFilter(remove!, "organization_id", ORG));
  assertEquals(s.tables.conversations!.filter((c) => c.id === CONV), []);
  assertEquals(s.tables.conversations!.filter((c) => c.organization_id === OTHER_ORG).length, 1);

  const audit = s.db.rpcs.find((r) => r.name === "write_audit")!;
  assertEquals(audit.params.p_org, ORG);
  assertEquals(audit.params.p_action, "conversation.deleted_by_customer");
  assert(!JSON.stringify(audit.params).includes("Sara"));
  assert(!JSON.stringify(audit.params).includes(TOKEN));

  const after = await s.call({ action: "poll", session_token: TOKEN });
  assertEquals(after.status, 404);
});

Deno.test("requests: unknown actions and malformed bodies are rejected", async () => {
  const s = await setup();
  assertEquals((await s.call({ action: "export" })).status, 400);
  assertEquals((await s.call({ action: "profile", slug: "../etc" })).status, 400);
  assertEquals((await s.call({ action: "poll", session_token: "short" })).status, 400);
});
