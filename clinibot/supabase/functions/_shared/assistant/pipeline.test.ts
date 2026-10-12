import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { Anthropic } from "../deps.ts";
import { FakeClaude, type FakeDb, hasFilter, message, type Row, text, thinking, toolUse } from "./fakes.ts";
import { clinicDb, CONV, ORG, OTHER_CONV, type SeedOptions } from "./fixtures.ts";
import { optedOutConfirmation, unavailableNotice } from "./notices.ts";
import { handleInboundMessage, type PipelineInput, toModelHistory } from "./pipeline.ts";

const NOW = new Date("2026-10-12T09:00:00.000Z");
const KEY = "ANTHROPIC_API_KEY";
Deno.env.set(KEY, "sk-ant-test-key");

let clock = Date.parse("2026-10-12T08:30:00.000Z");
function row(conversationId: string, sender: string, body: string, organizationId = ORG): Row {
  return {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    conversation_id: conversationId,
    direction: sender === "customer" ? "inbound" : "outbound",
    sender,
    body,
    status: sender === "customer" ? "received" : "sent",
    created_at: new Date(clock += 1000).toISOString(),
  };
}

interface Setup extends SeedOptions {
  text?: string;
  channel?: "web" | "whatsapp";
  customerPhone?: string | null;
}

/** A clinic whose conversation CONV has just received `text` (stored, as the caller does before the pipeline). */
function setup(options: Setup = {}) {
  const messageText = options.text ?? "كم سعر تنظيف الأسنان؟";
  const clinic = clinicDb({ ...options, messages: [...(options.messages ?? []), row(CONV, "customer", messageText)] });
  const input: PipelineInput = {
    db: clinic.db.asDb(),
    organizationId: ORG,
    conversationId: CONV,
    channel: options.channel ?? "web",
    text: messageText,
    customerPhone: options.customerPhone ?? null,
  };
  const conversation = () => clinic.tables.conversations!.find((r) => r.id === CONV)!;
  return { ...clinic, input, conversation };
}

function run(input: PipelineInput, claude: FakeClaude) {
  return handleInboundMessage(input, { messagesClient: claude, now: () => NOW });
}

/** Every query the pipeline made touched only the clinic it was given. */
function assertScoped(db: FakeDb): void {
  for (const query of db.queries) {
    const label = `${query.operation} ${query.table}`;
    if (query.table === "organizations") assert(hasFilter(query, "id", ORG), label);
    else if (query.operation === "insert") assertEquals((query.values as Row).organization_id, ORG, label);
    else assert(hasFilter(query, "organization_id", ORG), label);
  }
  for (const rpc of db.rpcs) {
    if ("p_org" in rpc.params) assertEquals(rpc.params.p_org, ORG, rpc.name);
  }
}

const reply = (value: string, usage = {}) => message("end_turn", [thinking(), text(value)], usage);

Deno.test("answered: the model's reply, usage recorded, language stored", async () => {
  const s = setup({ conversation: { language: "en" } });
  const claude = new FakeClaude([reply("سعر تنظيف الأسنان 250 ريال.", { input_tokens: 120, output_tokens: 30 })]);
  const result = await run(s.input, claude);

  assertEquals(result, {
    outbound: [{
      sender: "assistant",
      body: "سعر تنظيف الأسنان 250 ريال.",
      aiModel: "claude-opus-5-5",
      inputTokens: 120,
      outputTokens: 30,
    }],
    outcome: "answered",
    status: "open",
    aiPaused: false,
  });
  assertEquals(claude.calls.length, 1);
  assertEquals(claude.calls[0]!.messages, [{ role: "user", content: "كم سعر تنظيف الأسنان؟" }]);
  const system = claude.calls[0]!.system as Array<{ text: string }>;
  assertStringIncludes(system[2]!.text, "Channel: web chat");
  assertStringIncludes(system[2]!.text, "Arabic");
  assertEquals(s.conversation().language, "ar");
  const usage = s.db.rpcs.filter((r) => r.name === "record_ai_usage");
  assertEquals(usage, [{
    name: "record_ai_usage",
    params: { p_org: ORG, p_input_tokens: 120, p_output_tokens: 30, p_is_test: false },
  }]);
  assertEquals(s.db.rpcs.find((r) => r.name === "consume_rate_limit")?.params, {
    p_key: `ai:conv:${CONV}`,
    p_limit: 30,
    p_window_seconds: 3600,
  });
  assertScoped(s.db);
});

Deno.test("history: plain text from the database, chronological, customer first, staff marked, notices skipped", () => {
  const rows = [
    { direction: "outbound" as const, sender: "system" as const, body: "welcome" },
    { direction: "outbound" as const, sender: "assistant" as const, body: "orphan assistant line" },
    { direction: "inbound" as const, sender: "customer" as const, body: "hi" },
    { direction: "outbound" as const, sender: "assistant" as const, body: "hello" },
    { direction: "outbound" as const, sender: "staff" as const, body: "Dr. Huda here" },
    { direction: "outbound" as const, sender: "system" as const, body: "notice" },
    { direction: "inbound" as const, sender: "customer" as const, body: "thanks" },
    { direction: "inbound" as const, sender: "customer" as const, body: "one more thing" },
  ];
  assertEquals(toModelHistory(rows, "one more thing"), [
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "assistant", content: "[Clinic staff] Dr. Huda here" },
    { role: "user", content: "thanks" },
    { role: "user", content: "one more thing" },
  ]);
  // The latest message is always last, even if it is not visible in the history yet.
  assertEquals(toModelHistory([], "first"), [{ role: "user", content: "first" }]);
});

Deno.test("history: last 20 messages of this conversation only", async () => {
  const older = Array.from({ length: 24 }, (_, i) => row(CONV, i % 2 === 0 ? "customer" : "assistant", `m${i}`));
  const s = setup({ messages: [...older, row(OTHER_CONV, "customer", "other clinic secret", "x")] });
  const claude = new FakeClaude([reply("أهلًا")]);
  await run(s.input, claude);

  const sent = claude.calls[0]!.messages;
  const history = s.db.on("messages", "select").find((q) => q.limit === 20)!;
  assert(hasFilter(history, "conversation_id", CONV));
  assert(hasFilter(history, "organization_id", ORG));
  // 20 newest: m5..m23 and the new message; m5 is an assistant line, so it is dropped to start with the customer.
  assertEquals(sent[0], { role: "user", content: "m6" });
  assertEquals(sent[sent.length - 1], { role: "user", content: "كم سعر تنظيف الأسنان؟" });
  assertEquals(sent.length, 19);
  assert(!JSON.stringify(sent).includes("other clinic"));
});

Deno.test("STOP: opts out immediately, even when paused, without calling the model", async () => {
  for (const [command, language] of [["STOP", "en"], ["إيقاف", "ar"]] as const) {
    const s = setup({ text: command, conversation: { ai_paused: true, status: "awaiting_human" } });
    const claude = new FakeClaude([]);
    const result = await run(s.input, claude);
    assertEquals(result, {
      outbound: [{ sender: "system", body: optedOutConfirmation(language) }],
      outcome: "opted_out_now",
      status: "awaiting_human",
      aiPaused: true,
    });
    assertEquals(s.conversation().opted_out_at, NOW.toISOString());
    assertEquals(s.conversation().ai_paused, true);
    assertEquals(claude.calls.length, 0);
    assertScoped(s.db);
  }
});

Deno.test("DELETE MY DATA: deletes this conversation's messages and name only, audited without content", async () => {
  const s = setup({
    text: "حذف بياناتي",
    conversation: { customer_name: "Sara", opted_out_at: "2026-10-01T00:00:00.000Z" },
    messages: [row(CONV, "customer", "my phone is 0551234567"), row(CONV, "assistant", "ok")],
  });
  const claude = new FakeClaude([]);
  const result = await run(s.input, claude);

  assertEquals(result.outcome, "data_deleted");
  assertEquals(result.outbound.length, 1);
  assertEquals(result.outbound[0]!.sender, "system");
  assertStringIncludes(result.outbound[0]!.body, "تم حذف رسائلك");
  assertEquals(s.tables.messages!.filter((m) => m.conversation_id === CONV), []);
  assertEquals(s.tables.messages!.filter((m) => m.conversation_id === OTHER_CONV).length, 1);
  assertEquals(s.conversation().customer_name, null);
  const [remove] = s.db.on("messages", "delete");
  assert(hasFilter(remove!, "organization_id", ORG));
  assert(hasFilter(remove!, "conversation_id", CONV));
  const audit = s.db.rpcs.find((r) => r.name === "write_audit")!;
  assertEquals(audit.params.p_action, "conversation.data_deleted_by_customer");
  assertEquals(audit.params.p_entity_id, CONV);
  assert(!JSON.stringify(audit.params).includes("0551234567"));
  assertEquals(claude.calls.length, 0);
  assertScoped(s.db);
});

Deno.test("opted-out and paused conversations get no reply and no model call", async () => {
  const optedOut = setup({ conversation: { opted_out_at: "2026-10-01T00:00:00.000Z", ai_paused: true } });
  const paused = setup({ conversation: { ai_paused: true, status: "awaiting_human" } });
  for (const [s, outcome] of [[optedOut, "opted_out"], [paused, "paused"]] as const) {
    const claude = new FakeClaude([reply("should never be sent")]);
    const result = await run(s.input, claude);
    assertEquals(result.outcome, outcome);
    assertEquals(result.outbound, []);
    assertEquals(claude.calls.length, 0);
    assertEquals(s.db.rpcs.filter((r) => r.name === "record_ai_usage"), []);
  }
});

Deno.test("WhatsApp first contact: privacy notice first, then the reply; never twice", async () => {
  const s = setup({
    channel: "whatsapp",
    customerPhone: "+966500000001",
    conversation: {
      channel: "whatsapp",
      privacy_notice_sent_at: null,
      web_session_hash: null,
      customer_wa_id: "966500000001",
    },
  });
  const first = await run(s.input, new FakeClaude([reply("أهلًا بك")]));
  assertEquals(first.outbound.map((o) => o.sender), ["system", "assistant"]);
  const notice = first.outbound[0]!.body;
  assertStringIncludes(notice, "عيادة الابتسامة");
  assertStringIncludes(notice, "180");
  assertStringIncludes(notice, "حذف بياناتي");
  assertStringIncludes(notice, "إيقاف");
  assertEquals(s.conversation().privacy_notice_sent_at, NOW.toISOString());

  const second = await run(s.input, new FakeClaude([reply("تفضل")]));
  assertEquals(second.outbound.map((o) => o.sender), ["assistant"]);

  const custom = setup({
    channel: "whatsapp",
    text: "Hello, what are your hours?",
    settings: { privacy_notice_en: "Our own privacy wording." },
    conversation: { channel: "whatsapp", privacy_notice_sent_at: null },
  });
  const result = await run(custom.input, new FakeClaude([reply("We open at 9.")]));
  assertEquals(result.outbound[0]!.body, "Our own privacy wording.");
});

Deno.test("emergency: guidance without the model, handed to staff, checked before availability", async () => {
  const arabic = setup({ text: "أبوي عنده ألم في الصدر", settings: { assistant_enabled: false } });
  const claude = new FakeClaude([]);
  const result = await run(arabic.input, claude);
  assertEquals(result.outcome, "emergency");
  assertEquals(result.status, "awaiting_human");
  assertEquals(result.aiPaused, true);
  assertEquals(result.outbound.length, 1);
  assertEquals(result.outbound[0]!.sender, "system");
  assertStringIncludes(result.outbound[0]!.body, "997");
  assertEquals(arabic.conversation().handoff_reason, "possible_emergency");
  assertEquals(arabic.conversation().ai_paused, true);
  assertEquals(arabic.conversation().status, "awaiting_human");
  assertEquals(claude.calls.length, 0);
  assertScoped(arabic.db);

  const english = setup({ text: "My son can't breathe", settings: { emergency_number: "911" } });
  const en = await run(english.input, new FakeClaude([]));
  assertEquals(en.outcome, "emergency");
  assertStringIncludes(en.outbound[0]!.body, "call 911");
});

Deno.test("unavailable: one notice to the customer, not repeated while reception has not replied", async () => {
  const s = setup({ settings: { assistant_enabled: false } });
  const claude = new FakeClaude([]);
  const first = await run(s.input, claude);
  assertEquals(first, {
    outbound: [{ sender: "system", body: unavailableNotice("ar") }],
    outcome: "unavailable",
    status: "awaiting_human",
    aiPaused: false,
  });
  assertEquals(s.conversation().status, "awaiting_human");

  // The caller stores the notice; the customer writes again.
  s.tables.messages!.push(row(CONV, "system", unavailableNotice("ar")), row(CONV, "customer", "ألو؟"));
  const second = await run({ ...s.input, text: "ألو؟" }, claude);
  assertEquals(second.outcome, "unavailable");
  assertEquals(second.outbound, []);
  assertEquals(claude.calls.length, 0);
  assertScoped(s.db);
});

Deno.test("unavailable: no API key, inactive subscription, unreadable entitlements or no AI replies left", async () => {
  const cases: Array<[string, (s: ReturnType<typeof setup>) => void]> = [
    ["no key", () => Deno.env.delete(KEY)],
    ["inactive", (s) => s.rpc.entitlements = { is_active: false, ai_replies_remaining: 50 }],
    ["unreadable", (s) => s.rpc.entitlements = null],
    ["quota", (s) => s.rpc.entitlements = { is_active: true, ai_replies_remaining: 0 }],
    ["entitlements error", (s) => {
      const rpc = s.db.rpc.bind(s.db);
      s.db.rpc = (name, params) =>
        name === "org_entitlements"
          ? Promise.resolve({ data: null, error: { message: "down", code: "XX000" } })
          : rpc(name, params);
    }],
  ];
  for (const [label, arrange] of cases) {
    const s = setup();
    arrange(s);
    const claude = new FakeClaude([reply("never")]);
    try {
      const result = await run(s.input, claude);
      assertEquals(result.outcome, "unavailable", label);
      assertEquals(result.outbound, [{ sender: "system", body: unavailableNotice("ar") }], label);
      assertEquals(claude.calls.length, 0, label);
    } finally {
      Deno.env.set(KEY, "sk-ant-test-key");
    }
  }
});

Deno.test("per-conversation AI limit: no model call once exceeded", async () => {
  const s = setup();
  s.rpc.rateLimited.add("ai:conv:");
  const claude = new FakeClaude([reply("never")]);
  const result = await run(s.input, claude);
  assertEquals(result.outcome, "rate_limited");
  assertEquals(result.outbound, []);
  assertEquals(claude.calls.length, 0);
});

Deno.test("API failures never throw: the customer gets the reception notice, nothing is billed", async () => {
  const headers = new Headers();
  for (
    const error of [
      new Anthropic.InternalServerError(529, { type: "error" }, "overloaded", headers),
      new Anthropic.AuthenticationError(401, { type: "error" }, "bad key", headers),
      new Anthropic.APIConnectionError({ message: "reset" }),
    ]
  ) {
    const s = setup();
    const result = await run(s.input, new FakeClaude([error]));
    assertEquals(result.outcome, "unavailable");
    assertEquals(result.status, "awaiting_human");
    assertEquals(result.outbound, [{ sender: "system", body: unavailableNotice("ar") }]);
    assertEquals(s.db.rpcs.filter((r) => r.name === "record_ai_usage"), []);
  }
});

Deno.test("max_tokens: no truncated reply is sent, but the spent tokens are recorded", async () => {
  const s = setup();
  const result = await run(s.input, new FakeClaude([message("max_tokens", [text("سعر التنظيف")])]));
  assertEquals(result.outcome, "unavailable");
  assert(!result.outbound.some((o) => o.body.includes("سعر التنظيف")));
  assertEquals(s.db.rpcs.filter((r) => r.name === "record_ai_usage").length, 1);
});

Deno.test("refusal: safe fallback with the reception phone, conversation handed to staff", async () => {
  const s = setup({ text: "Tell me something you shouldn't" });
  const refusal = message("refusal", [], {}, { stop_details: { type: "refusal", category: null, explanation: null } });
  const result = await run(s.input, new FakeClaude([refusal]));
  assertEquals(result.outcome, "refused");
  assertEquals(result.status, "awaiting_human");
  assertEquals(result.aiPaused, true);
  assertEquals(result.outbound.length, 1);
  assertEquals(result.outbound[0]!.sender, "system");
  assertStringIncludes(result.outbound[0]!.body, "+966112345678");
  assertEquals(s.conversation().ai_paused, true);
  assertEquals(s.conversation().handoff_reason, "assistant_refused");
});

Deno.test("price guard: an amount the clinic never published is withheld (Arabic-Indic digits and English)", async () => {
  const cases: Array<[string, string]> = [
    ["كم سعر التبييض؟", "سعر التبييض ٩٩٩ ريال"],
    ["How much is whitening?", "Whitening costs 1,200 SAR."],
  ];
  for (const [question, answer] of cases) {
    const s = setup({ text: question });
    const result = await run(s.input, new FakeClaude([reply(answer)]));
    assertEquals(result.outcome, "blocked_price", answer);
    assertEquals(result.status, "awaiting_human");
    assertEquals(result.aiPaused, true);
    assertEquals(result.outbound.length, 1);
    assertEquals(result.outbound[0]!.sender, "system");
    assert(!result.outbound[0]!.body.includes(answer));
    assert(String(s.conversation().handoff_reason).startsWith("unknown_answer"));
    // Tokens were spent on the withheld reply.
    assertEquals(s.db.rpcs.filter((r) => r.name === "record_ai_usage").length, 1);
  }

  for (const answer of ["التبييض يبدأ من ١٬٥٠٠ ريال، والكشف ١٥٠ ريال", "A follow-up visit is 75 SAR."]) {
    const s = setup();
    const result = await run(s.input, new FakeClaude([reply(answer)]));
    assertEquals(result.outcome, "answered", answer);
    assertEquals(result.outbound[0]!.body, answer);
  }
});

Deno.test("handoff tool: the reply goes out and the conversation waits for staff", async () => {
  const s = setup({ text: "عندي حساسية من البنج، هل التنظيف آمن لي؟" });
  const claude = new FakeClaude([
    message("tool_use", [
      thinking(),
      toolUse("request_human_handoff", { reason: "medical_question", summary: "Asks about anaesthetic allergy" }, "t1"),
    ]),
    reply("لا أستطيع تقديم استشارة طبية، وقد حولت سؤالك لفريق العيادة."),
  ]);
  const result = await run(s.input, claude);
  assertEquals(result.outcome, "handoff");
  assertEquals(result.status, "awaiting_human");
  assertEquals(result.aiPaused, true);
  assertEquals(result.outbound.map((o) => o.sender), ["assistant"]);
  assertEquals(s.conversation().handoff_reason, "medical_question: Asks about anaesthetic allergy");
  const toolResult = claude.calls[1]!.messages[2]!;
  assertEquals(toolResult.role, "user");
  assertScoped(s.db);
});

Deno.test("a turn that fails after a handoff still reports the assistant as paused", async () => {
  const s = setup();
  const claude = new FakeClaude([
    message("tool_use", [toolUse("request_human_handoff", { reason: "complaint", summary: "Unhappy" })]),
    new Anthropic.InternalServerError(500, { type: "error" }, "boom", new Headers()),
  ]);
  const result = await run(s.input, claude);
  assertEquals(result.outcome, "unavailable");
  assertEquals(result.aiPaused, true);
  assertEquals(s.conversation().ai_paused, true);
});

Deno.test("appointment tool from WhatsApp: saved with the sender's number, then the reply", async () => {
  const s = setup({
    channel: "whatsapp",
    customerPhone: "+966500000001",
    text: "أبغى موعد تنظيف بكرة الصباح، اسمي سارة",
    conversation: { channel: "whatsapp", privacy_notice_sent_at: "2026-10-01T00:00:00.000Z" },
  });
  const claude = new FakeClaude([
    message("tool_use", [
      toolUse("create_appointment_request", {
        customer_name: "سارة",
        customer_phone: null,
        service_id: null,
        preferred_date: "2026-10-13",
        preferred_time_window: "morning",
        notes: null,
      }),
    ]),
    reply("تم استلام طلبك، وستتواصل معك العيادة لتأكيد الموعد."),
  ]);
  const result = await run(s.input, claude);
  assertEquals(result.outcome, "answered");
  const [saved] = s.tables.appointment_requests!;
  assertEquals(saved?.customer_phone, "+966500000001");
  assertEquals(saved?.source, "whatsapp");
  assertEquals(saved?.conversation_id, CONV);
  assertEquals(saved?.organization_id, ORG);
  assertScoped(s.db);
});
