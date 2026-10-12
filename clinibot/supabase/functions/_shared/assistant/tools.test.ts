import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { FakeDb, hasFilter } from "./fakes.ts";
import {
  clinicDb,
  CONV,
  knowledgeBase,
  ORG,
  OTHER_CONV,
  SERVICE_CLEANING,
  SERVICE_INACTIVE,
  SERVICE_OTHER_CLINIC,
} from "./fixtures.ts";
import {
  createLiveTools,
  createTestTools,
  dateProblem,
  type LiveToolContext,
  MAX_REQUESTS_PER_DAY,
  TEST_REQUEST_ID,
} from "./tools.ts";

// 09:00 in Riyadh on Monday 2026-10-12.
const NOW = new Date("2026-10-12T06:00:00.000Z");

function request(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    customer_name: "Sara Ahmed",
    customer_phone: "٠٥٥١٢٣٤٥٦٧",
    service_id: SERVICE_CLEANING,
    preferred_date: "2026-10-14",
    preferred_time_window: "evening",
    notes: null,
    ...overrides,
  };
}

function live(db: FakeDb, overrides: Partial<LiveToolContext> = {}) {
  return createLiveTools({
    db: db.asDb(),
    organizationId: ORG,
    conversationId: CONV,
    channel: "web",
    customerPhone: null,
    now: () => NOW,
    ...overrides,
  });
}

Deno.test("appointment: saved for this clinic and conversation, phone normalised from Arabic-Indic digits", async () => {
  const { db, tables } = clinicDb();
  const tools = live(db);
  const execution = await tools.execute("create_appointment_request", request());

  assertEquals(execution.isError, false);
  assertEquals(execution.result.ok, true);
  assertEquals(execution.result.status, "new");
  const rows = tables.appointment_requests!;
  assertEquals(rows.length, 1);
  assertEquals(execution.result.request_id, rows[0]!.id);
  const [insert] = db.on("appointment_requests", "insert");
  assertEquals(insert!.values, {
    organization_id: ORG,
    conversation_id: CONV,
    service_id: SERVICE_CLEANING,
    customer_name: "Sara Ahmed",
    customer_phone: "+966551234567",
    preferred_date: "2026-10-14",
    preferred_time_window: "evening",
    customer_notes: null,
    source: "web_chat",
  });
  // The service check and the daily cap are both scoped to this clinic.
  const [lookup] = db.on("clinic_services", "select");
  assert(hasFilter(lookup!, "organization_id", ORG));
  assert(hasFilter(lookup!, "is_active", true));
  const [count] = db.on("appointment_requests", "select");
  assert(hasFilter(count!, "organization_id", ORG));
  assert(hasFilter(count!, "conversation_id", CONV));
  assertEquals(tools.report.appointment?.saved, true);
  assertEquals(tools.report.appointment?.request_id, rows[0]!.id);
});

Deno.test("appointment: web chat needs a valid phone; WhatsApp falls back to the sender's number", async () => {
  const web = clinicDb();
  for (const phone of [null, "12", "my number is secret"]) {
    const execution = await live(web.db).execute("create_appointment_request", request({ customer_phone: phone }));
    assertEquals(execution.isError, true, String(phone));
    assertStringIncludes(String(execution.result.error), "mobile number");
  }
  assertEquals(web.db.on("appointment_requests", "insert").length, 0);

  const wa = clinicDb();
  const tools = live(wa.db, { channel: "whatsapp", customerPhone: "+966500000001" });
  const execution = await tools.execute("create_appointment_request", request({ customer_phone: null }));
  assertEquals(execution.isError, false);
  assertEquals(wa.tables.appointment_requests![0]!.customer_phone, "+966500000001");
  assertEquals(wa.tables.appointment_requests![0]!.source, "whatsapp");

  // A number the customer typed wins over the sender's.
  const typed = clinicDb();
  await live(typed.db, { channel: "whatsapp", customerPhone: "+966500000001" })
    .execute("create_appointment_request", request({ customer_phone: "+966 55 999 8888" }));
  assertEquals(typed.tables.appointment_requests![0]!.customer_phone, "+966559998888");
});

Deno.test("appointment: dates in the past (Riyadh time), too far ahead or impossible are rejected", async () => {
  // 00:30 on 2026-10-13 in Riyadh, still 2026-10-12 in UTC.
  const lateNight = new Date("2026-10-12T21:30:00.000Z");
  for (const date of ["2026-10-12", "2025-01-01"]) {
    const { db } = clinicDb();
    const execution = await live(db, { now: () => lateNight })
      .execute("create_appointment_request", request({ preferred_date: date }));
    assertEquals(execution.isError, true, date);
    assertStringIncludes(String(execution.result.error), "in the past");
    assertEquals(db.on("appointment_requests", "insert").length, 0);
  }
  assertEquals(dateProblem("2026-10-13", lateNight), null);
  assertEquals(dateProblem("2027-04-11", lateNight), null);
  assertStringIncludes(dateProblem("2027-04-12", lateNight) ?? "", "180 days");
  assertStringIncludes(dateProblem("2026-02-30", lateNight) ?? "", "not a real calendar date");

  const { db } = clinicDb();
  const malformed = await live(db).execute("create_appointment_request", request({ preferred_date: "next sunday" }));
  assertEquals(malformed.isError, true);
  assertStringIncludes(String(malformed.result.error), "preferred_date");
});

Deno.test("appointment: another clinic's, inactive or made-up service ids are rejected", async () => {
  for (const serviceId of [SERVICE_OTHER_CLINIC, SERVICE_INACTIVE, "teeth-cleaning"]) {
    const { db } = clinicDb();
    const execution = await live(db).execute("create_appointment_request", request({ service_id: serviceId }));
    assertEquals(execution.isError, true, serviceId);
    assertStringIncludes(String(execution.result.error), "Unknown service_id");
    assertEquals(db.on("appointment_requests", "insert").length, 0);
  }
  const { db } = clinicDb();
  const noService = await live(db).execute("create_appointment_request", request({ service_id: null }));
  assertEquals(noService.isError, false);
});

Deno.test("appointment: at most two requests per conversation per 24 hours", async () => {
  const recent = (hoursAgo: number, conversationId = CONV) => ({
    id: crypto.randomUUID(),
    organization_id: ORG,
    conversation_id: conversationId,
    created_at: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
  });
  const { db, tables } = clinicDb();
  // An old request and one in another conversation do not count.
  tables.appointment_requests!.push(recent(30), recent(1, OTHER_CONV), recent(2));

  const second = await live(db).execute("create_appointment_request", request());
  assertEquals(second.isError, false);
  const third = await live(db).execute("create_appointment_request", request());
  assertEquals(third.isError, true);
  assertStringIncludes(String(third.result.error), `${MAX_REQUESTS_PER_DAY} appointment requests`);
  assertEquals(db.on("appointment_requests", "insert").length, 1);
});

Deno.test("appointment: input the schema does not allow is an error result naming the field", async () => {
  const { db } = clinicDb();
  const tools = live(db);
  const cases: unknown[] = [
    { customer_name: "Sara" },
    request({ preferred_time_window: "midnight" }),
    request({ customer_name: "S" }),
    request({ national_id: "1234567890" }),
    "not an object",
  ];
  for (const input of cases) {
    const execution = await tools.execute("create_appointment_request", input);
    assertEquals(execution.isError, true, JSON.stringify(input));
    assertStringIncludes(String(execution.result.error), "Invalid input");
    // Validation messages never echo what the customer typed.
    assert(!String(execution.result.error).includes("1234567890"));
  }
  assertEquals(db.on("appointment_requests", "insert").length, 0);
  assertEquals(tools.report.appointment, null);
});

Deno.test("appointment: a database failure is reported as nothing saved", async () => {
  const db = new FakeDb((query) => {
    if (query.table === "clinic_services") return { data: { id: SERVICE_CLEANING } };
    if (query.table === "appointment_requests" && query.operation === "select") return { count: 0 };
    if (query.table === "appointment_requests") return { error: { message: "boom", code: "23514" } };
    return undefined;
  });
  const tools = live(db);
  const execution = await tools.execute("create_appointment_request", request());
  assertEquals(execution.isError, true);
  assertStringIncludes(String(execution.result.error), "nothing was saved");
  assertEquals(tools.report.appointment, null);
});

Deno.test("handoff: pauses the assistant on this clinic's conversation with reason and truncated summary", async () => {
  const { db, tables } = clinicDb();
  const tools = live(db);
  const execution = await tools.execute("request_human_handoff", {
    reason: "medical_question",
    summary: "x".repeat(400),
  });
  assertEquals(execution, { result: { ok: true, status: "awaiting_human" }, isError: false });
  const [update] = db.on("conversations", "update");
  assert(hasFilter(update!, "id", CONV));
  assert(hasFilter(update!, "organization_id", ORG));
  const conversation = tables.conversations!.find((row) => row.id === CONV)!;
  assertEquals(conversation.status, "awaiting_human");
  assertEquals(conversation.ai_paused, true);
  assertEquals(conversation.handoff_reason, `medical_question: ${"x".repeat(300)}`);
  assertEquals(tools.report.handoff, { reason: "medical_question", summary: "x".repeat(300) });
  // The other clinic's conversation is untouched.
  assertEquals(tables.conversations!.find((row) => row.id === OTHER_CONV)!.ai_paused, false);

  const bad = await tools.execute("request_human_handoff", { reason: "bored", summary: "x" });
  assertEquals(bad.isError, true);
  const unknown = await tools.execute("delete_everything", {});
  assertEquals(unknown.isError, true);
  assertStringIncludes(String(unknown.result.error), "Unknown tool");
});

Deno.test("test mode: validates like live mode but writes nothing", async () => {
  const tools = createTestTools(knowledgeBase(), () => NOW);
  const created = await tools.execute("create_appointment_request", request());
  assertEquals(created, { result: { ok: true, request_id: TEST_REQUEST_ID, status: "new" }, isError: false });
  assertEquals(tools.report.appointment, {
    customer_name: "Sara Ahmed",
    service_id: SERVICE_CLEANING,
    preferred_date: "2026-10-14",
    preferred_time_window: "evening",
    saved: false,
    request_id: null,
  });

  const foreign = await tools.execute("create_appointment_request", request({ service_id: SERVICE_OTHER_CLINIC }));
  assertEquals(foreign.isError, true);
  const past = await tools.execute("create_appointment_request", request({ preferred_date: "2026-10-11" }));
  assertEquals(past.isError, true);

  const handoff = await tools.execute("request_human_handoff", { reason: "complaint", summary: "Unhappy" });
  assertEquals(handoff.isError, false);
  assertEquals(tools.report.handoff, { reason: "complaint", summary: "Unhappy" });
});
