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
const SERVICE = "30000000-0000-4000-8000-000000000001";
// 13:30 UTC = 4:30 pm in Riyadh.
const SCHEDULED = "2026-10-20T13:30:00+00:00";

const CONV = {
  web: "10000000-0000-4000-8000-000000000001",
  wa: "10000000-0000-4000-8000-000000000002",
  waOld: "10000000-0000-4000-8000-000000000003",
  waStop: "10000000-0000-4000-8000-000000000004",
  foreign: "10000000-0000-4000-8000-000000000005",
};

const APPT = {
  web: "40000000-0000-4000-8000-000000000001",
  wa: "40000000-0000-4000-8000-000000000002",
  waOld: "40000000-0000-4000-8000-000000000003",
  waStop: "40000000-0000-4000-8000-000000000004",
  unconfirmed: "40000000-0000-4000-8000-000000000005",
  manual: "40000000-0000-4000-8000-000000000006",
  foreign: "40000000-0000-4000-8000-000000000007",
  missing: "40000000-0000-4000-8000-000000000099",
};

function conversation(id: string, organizationId: string, extra: Row = {}): Row {
  return {
    id,
    organization_id: organizationId,
    channel: "whatsapp",
    customer_wa_id: "966512345678",
    opted_out_at: null,
    last_inbound_at: new Date(NOW.getTime() - HOUR).toISOString(),
    language: null,
    ...extra,
  };
}

function appointment(id: string, conversationId: string | null, extra: Row = {}): Row {
  return {
    id,
    organization_id: ORG,
    conversation_id: conversationId,
    service_id: SERVICE,
    customer_name: "سارة",
    customer_phone: "+966512345678",
    status: "confirmed",
    scheduled_for: SCHEDULED,
    customer_notified_at: null,
    ...extra,
  };
}

const INTEGRATION: Row = {
  ...DEFAULTS.integration_settings!(),
  id: "20000000-0000-4000-8000-000000000001",
  organization_id: ORG,
  status: "connected",
  phone_number_id: "106540352242922",
};

async function setup(integration: Row | null = INTEGRATION): Promise<FakeDb> {
  const db = new FakeDb({
    tables: {
      organization_members: [
        { organization_id: ORG, user_id: "user-recep", role: "receptionist" },
        { organization_id: OTHER_ORG, user_id: "user-other", role: "owner" },
      ],
      organizations: [
        { id: ORG, name: "Smile Dental", phone: "+966110000000", default_language: "ar" },
        { id: OTHER_ORG, name: "Other", phone: null, default_language: "en" },
      ],
      clinic_settings: [{
        organization_id: ORG,
        display_name_ar: "عيادة الابتسامة",
        display_name_en: "Smile Clinic",
        address_ar: "الرياض، حي العليا",
        address_en: "Olaya, Riyadh",
        reception_phone: "+966112345678",
        timezone: "Asia/Riyadh",
      }],
      clinic_services: [{ id: SERVICE, organization_id: ORG, name_ar: "تنظيف الأسنان", name_en: "Teeth cleaning" }],
      conversations: [
        conversation(CONV.web, ORG, { channel: "web", customer_wa_id: null, language: "en" }),
        conversation(CONV.wa, ORG),
        conversation(CONV.waOld, ORG, { last_inbound_at: new Date(NOW.getTime() - 30 * HOUR).toISOString() }),
        conversation(CONV.waStop, ORG, { opted_out_at: NOW.toISOString() }),
        conversation(CONV.foreign, OTHER_ORG),
      ],
      appointment_requests: [
        appointment(APPT.web, CONV.web),
        appointment(APPT.wa, CONV.wa),
        appointment(APPT.waOld, CONV.waOld),
        appointment(APPT.waStop, CONV.waStop),
        appointment(APPT.unconfirmed, CONV.wa, { status: "contacted", scheduled_for: null }),
        appointment(APPT.manual, null),
        appointment(APPT.foreign, CONV.foreign, { organization_id: OTHER_ORG }),
      ],
      integration_settings: integration ? [integration] : [],
    },
    users: { "token-recep": "user-recep", "token-other": "user-other" },
  });
  if (integration) await saveTestCredentials(db, integration, "EAAGnotifyTOKEN0123456789");
  return db;
}

async function call(db: FakeDb, id: string, replies: FetchReply[] = [], token = "token-recep") {
  const fake = fakeFetch(...replies);
  const response = await handle(
    "appointment-notify",
    createHandler(() => ({ db: db.db, fetch: fake.fetch, now: () => NOW })),
  )(staffRequest({ appointment_request_id: id }, token));
  return { response, body: await response.json(), fetches: fake.calls };
}

function appt(db: FakeDb, id: string): Row {
  return db.tables.appointment_requests!.find((a) => a.id === id)!;
}

const accepted = (id = "wamid.CONF") => jsonResponse({ messaging_product: "whatsapp", messages: [{ id }] });

Deno.test("web: the confirmation is stored in the customer's language and the request marked notified", async () => {
  const db = await setup();
  const { response, body, fetches } = await call(db, APPT.web);
  assertEquals(response.status, 200);
  assertEquals(fetches.length, 0);
  assertEquals(body.channel, "web");
  assertEquals(body.notified_at, NOW.toISOString());
  assertEquals(body.message.status, "sent");
  assertEquals(body.message.sender, "staff");
  assertEquals(
    body.message.body,
    [
      "Hello سارة,",
      "Smile Clinic has confirmed your appointment.",
      "Service: Teeth cleaning",
      "Date: Tuesday, 20 October 2026",
      "Time: 4:30 pm",
      "Address: Olaya, Riyadh",
      "To change or cancel it, please contact reception on +966112345678.",
    ].join("\n"),
  );
  assertEquals(appt(db, APPT.web).customer_notified_at, NOW.toISOString());
  assertEquals(db.audits.map((a) => [a.action, a.entity, a.details.channel]), [
    ["appointment.customer_notified", APPT.web, "web"],
  ]);
  for (const update of db.callsTo("appointment_requests", "update")) assert(scopedTo(update, ORG));
  for (const table of ["conversations", "clinic_settings", "clinic_services"]) {
    for (const select of db.callsTo(table, "select")) assert(scopedTo(select, ORG), table);
  }
});

Deno.test("whatsapp inside the window: free-text confirmation in Arabic (the clinic default)", async () => {
  const db = await setup();
  let notifiedDuringSend: unknown = "unset";
  const { response, body, fetches } = await call(db, APPT.wa, [() => {
    notifiedDuringSend = appt(db, APPT.wa).customer_notified_at;
    return accepted("wamid.AR");
  }]);
  assertEquals(response.status, 200);
  assertEquals(notifiedDuringSend, null);
  assertEquals(body.channel, "whatsapp");
  assertEquals(body.message.status, "sent");
  const sent = fetches[0]?.body as { type: string; to: string; text: { body: string } };
  assertEquals([sent.type, sent.to], ["text", "966512345678"]);
  assert(sent.text.body.startsWith("مرحباً سارة،\nتم تأكيد موعدك لدى عيادة الابتسامة."));
  assert(sent.text.body.includes("التاريخ: الثلاثاء، 20 أكتوبر 2026"));
  assert(sent.text.body.includes("الوقت: 4:30 م"));
  assert(sent.text.body.includes("الخدمة: تنظيف الأسنان"));
  assertEquals(db.tables.messages![0]!.wa_message_id, "wamid.AR");
  assertEquals(appt(db, APPT.wa).customer_notified_at, NOW.toISOString());
});

Deno.test("whatsapp outside the window: the configured template with name, date and time", async () => {
  const db = await setup({ ...INTEGRATION, confirmation_template_name: "appointment_confirmed" });
  const { response, body, fetches } = await call(db, APPT.waOld, [accepted("wamid.TPL")]);
  assertEquals(response.status, 200);
  assertEquals(fetches[0]?.body, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "966512345678",
    type: "template",
    template: {
      name: "appointment_confirmed",
      language: { code: "ar" },
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: "سارة" },
          { type: "text", text: "الثلاثاء، 20 أكتوبر 2026" },
          { type: "text", text: "4:30 م" },
        ],
      }],
    },
  });
  assertEquals(body.message.body, "[template appointment_confirmed (ar)] سارة | الثلاثاء، 20 أكتوبر 2026 | 4:30 م");
  assertEquals(appt(db, APPT.waOld).customer_notified_at, NOW.toISOString());
  assertEquals(db.audits[0]?.details.template, true);
});

Deno.test("whatsapp outside the window without a template: template_required, nothing sent", async () => {
  const db = await setup();
  const { response, body, fetches } = await call(db, APPT.waOld);
  assertEquals(response.status, 409);
  assertEquals(body.error, "template_required");
  assertEquals(fetches.length, 0);
  assertEquals(db.tables.messages ?? [], []);
  assertEquals(appt(db, APPT.waOld).customer_notified_at, null);
});

Deno.test("a send failure is stored as failed, answered 502, and the request is not marked notified", async () => {
  const db = await setup();
  const { response, body } = await call(db, APPT.wa, [metaError(131026, "Message undeliverable")]);
  assertEquals(response.status, 502);
  assertEquals(body.error, "upstream_error");
  assertEquals(body.details.provider, "meta");
  assertEquals(body.details.meta_code, 131026);
  assertEquals(db.tables.messages![0]!.status, "failed");
  assertEquals(db.tables.messages![0]!.error_code, "131026");
  assertEquals(appt(db, APPT.wa).customer_notified_at, null);
  assertEquals(db.audits, []);
});

Deno.test("a network failure is also an honest 502", async () => {
  const db = await setup();
  const { response } = await call(db, APPT.wa, [new TypeError("connection reset")]);
  assertEquals(response.status, 502);
  assertEquals(appt(db, APPT.wa).customer_notified_at, null);
});

Deno.test("only confirmed requests with a time can be notified", async () => {
  const db = await setup();
  const { response, body, fetches } = await call(db, APPT.unconfirmed);
  assertEquals(response.status, 409);
  assertEquals(body.error, "not_confirmed");
  assertEquals(fetches.length, 0);
});

Deno.test("a request logged by hand has no channel", async () => {
  const db = await setup();
  const { response, body } = await call(db, APPT.manual);
  assertEquals(response.status, 409);
  assertEquals(body.error, "no_channel");
});

Deno.test("unknown and other clinics' requests get the same 404", async () => {
  const db = await setup();
  const missing = await call(db, APPT.missing);
  const foreign = await call(db, APPT.foreign);
  assertEquals([missing.response.status, foreign.response.status], [404, 404]);
  assertEquals([missing.body.error, foreign.body.error], ["not_found", "not_found"]);
  assertEquals(foreign.fetches.length, 0);
  assertEquals(appt(db, APPT.foreign).customer_notified_at, null);
});

Deno.test("opted-out customers and disconnected clinics are refused", async () => {
  const stop = await call(await setup(), APPT.waStop);
  assertEquals([stop.response.status, stop.body.error], [409, "customer_opted_out"]);
  const disconnected = await call(await setup(null), APPT.wa);
  assertEquals([disconnected.response.status, disconnected.body.error], [409, "whatsapp_not_connected"]);
  assertEquals(disconnected.fetches.length, 0);

  // A web chat visitor who sent STOP is not messaged either.
  const webDb = await setup();
  webDb.tables.conversations!.find((c) => c.id === CONV.web)!.opted_out_at = NOW.toISOString();
  const webStop = await call(webDb, APPT.web);
  assertEquals([webStop.response.status, webStop.body.error], [409, "customer_opted_out"]);
  assertEquals(webDb.tables.messages ?? [], []);
  assertEquals(appt(webDb, APPT.web).customer_notified_at, null);
});

Deno.test("if staff changed the time while sending, the request is not marked notified", async () => {
  const db = await setup();
  const { response, body } = await call(db, APPT.wa, [() => {
    // What the database trigger does when scheduled_for changes.
    Object.assign(appt(db, APPT.wa), { scheduled_for: "2026-10-21T08:00:00+00:00", customer_notified_at: null });
    return accepted();
  }]);
  assertEquals(response.status, 200);
  assertEquals(body.notified_at, null);
  assertEquals(body.message.status, "sent");
  assertEquals(appt(db, APPT.wa).customer_notified_at, null);
});

Deno.test("notify is rate limited per user", async () => {
  const db = new FakeDb({ users: { "token-recep": "user-recep" }, rateLimited: true });
  const { response } = await call(db, APPT.wa);
  assertEquals(response.status, 429);
  assertEquals(db.rpcs[0]?.args.p_key, "notify:user:user-recep");
});

Deno.test("invalid ids are rejected", async () => {
  const db = await setup();
  const { response, body } = await call(db, "not-a-uuid");
  assertEquals(response.status, 400);
  assertEquals(body.error, "invalid_request");
});
