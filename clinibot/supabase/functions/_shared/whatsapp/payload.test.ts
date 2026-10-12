import { assertEquals } from "jsr:@std/assert@1.0.13";
import { parseWebhook } from "./payload.ts";

// Shapes follow Meta's published webhook examples for the Cloud API.
function envelope(value: Record<string, unknown>, field = "messages") {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "102290129340398", changes: [{ value, field }] }],
  };
}

const METADATA = { display_phone_number: "966500000001", phone_number_id: "106540352242922" };

Deno.test("text message with the contact's profile name", () => {
  const changes = parseWebhook(envelope({
    messaging_product: "whatsapp",
    metadata: METADATA,
    contacts: [{ profile: { name: "Sara" }, wa_id: "966512345678" }],
    messages: [{
      from: "966512345678",
      id: "wamid.HBgMOTY2NTEyMzQ1Njc4FQIAEhggQjVCNjQ2",
      timestamp: "1760263200",
      type: "text",
      text: { body: "كم سعر تنظيف الأسنان؟" },
    }],
  }));
  assertEquals(changes.length, 1);
  const change = changes[0]!;
  assertEquals(change.phoneNumberId, "106540352242922");
  assertEquals(change.displayPhoneNumber, "966500000001");
  assertEquals(change.statuses, []);
  assertEquals(change.messages, [{
    id: "wamid.HBgMOTY2NTEyMzQ1Njc4FQIAEhggQjVCNjQ2",
    from: "966512345678",
    timestamp: new Date(1760263200 * 1000),
    type: "text",
    text: "كم سعر تنظيف الأسنان؟",
    profileName: "Sara",
  }]);
});

Deno.test("interactive button and list replies, and template quick-reply buttons, yield their titles", () => {
  const [change] = parseWebhook(envelope({
    metadata: METADATA,
    contacts: [{ profile: { name: "Omar" }, wa_id: "966511111111" }],
    messages: [
      {
        from: "966511111111",
        id: "wamid.button",
        timestamp: "1760263201",
        type: "interactive",
        interactive: { type: "button_reply", button_reply: { id: "confirm", title: "Yes, confirm" } },
      },
      {
        from: "966511111111",
        id: "wamid.list",
        timestamp: "1760263202",
        type: "interactive",
        interactive: { type: "list_reply", list_reply: { id: "row-1", title: "Cleaning", description: "x" } },
      },
      {
        from: "966511111111",
        id: "wamid.quick",
        timestamp: "1760263203",
        type: "button",
        button: { payload: "STOP", text: "إيقاف" },
        context: { from: "966500000001", id: "wamid.template" },
      },
    ],
  }));
  assertEquals(change?.messages.map((m) => [m.type, m.text, m.profileName]), [
    ["interactive", "Yes, confirm", "Omar"],
    ["interactive", "Cleaning", "Omar"],
    ["button", "إيقاف", "Omar"],
  ]);
});

Deno.test("media messages are kept with no text", () => {
  const [change] = parseWebhook(envelope({
    metadata: METADATA,
    contacts: [{ profile: { name: "Lina" }, wa_id: "966522222222" }],
    messages: [{
      from: "966522222222",
      id: "wamid.image",
      timestamp: "1760263300",
      type: "image",
      image: { caption: "x-ray", mime_type: "image/jpeg", sha256: "abc", id: "1234567890" },
    }],
  }));
  assertEquals(change?.messages[0]?.type, "image");
  assertEquals(change?.messages[0]?.text, null);
});

Deno.test("statuses: sent, delivered, read and failed with error details", () => {
  const status = (id: string, value: string, extra: Record<string, unknown> = {}) => ({
    id,
    status: value,
    timestamp: "1760263400",
    recipient_id: "966512345678",
    conversation: { id: "c1", origin: { type: "service" } },
    pricing: { billable: true, pricing_model: "PMP", category: "service" },
    ...extra,
  });
  const [change] = parseWebhook(envelope({
    messaging_product: "whatsapp",
    metadata: METADATA,
    statuses: [
      status("wamid.1", "sent"),
      status("wamid.2", "delivered"),
      status("wamid.3", "read"),
      status("wamid.4", "failed", {
        errors: [{
          code: 131047,
          title: "Re-engagement message",
          message: "Re-engagement message",
          error_data: { details: "Message failed to send because more than 24 hours have passed." },
          href: "https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/",
        }],
      }),
      status("wamid.5", "deleted"),
    ],
  }));
  assertEquals(change?.messages, []);
  assertEquals(change?.statuses.map((s) => [s.id, s.status]), [
    ["wamid.1", "sent"],
    ["wamid.2", "delivered"],
    ["wamid.3", "read"],
    ["wamid.4", "failed"],
  ]);
  assertEquals(change?.statuses[3]?.errors, [{
    code: 131047,
    title: "Re-engagement message",
    message: "Re-engagement message",
    details: "Message failed to send because more than 24 hours have passed.",
  }]);
  assertEquals(change?.statuses[0]?.recipientId, "966512345678");
  assertEquals(change?.statuses[0]?.timestamp, new Date(1760263400 * 1000));
});

Deno.test("profile names are matched to the sender by wa_id", () => {
  const [change] = parseWebhook(envelope({
    metadata: METADATA,
    contacts: [
      { profile: { name: "First" }, wa_id: "966511111111" },
      { profile: { name: "Second" }, wa_id: "966522222222" },
    ],
    messages: [
      { from: "966522222222", id: "wamid.a", timestamp: "1760263500", type: "text", text: { body: "hi" } },
      { from: "966533333333", id: "wamid.b", timestamp: "1760263501", type: "text", text: { body: "hi" } },
    ],
  }));
  assertEquals(change?.messages.map((m) => m.profileName), ["Second", null]);
});

Deno.test("multiple entries and changes are all returned; other fields are skipped", () => {
  const changes = parseWebhook({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "1",
        changes: [
          { field: "messages", value: { metadata: { phone_number_id: "111111" }, messages: [] } },
          { field: "message_template_status_update", value: { event: "APPROVED" } },
        ],
      },
      { id: "2", changes: [{ field: "messages", value: { metadata: { phone_number_id: "222222" } } }] },
    ],
  });
  assertEquals(changes.map((c) => c.phoneNumberId), ["111111", "222222"]);
});

Deno.test("garbage input never throws and yields nothing", () => {
  const inputs: unknown[] = [
    null,
    undefined,
    42,
    "string",
    [],
    {},
    { object: "page", entry: [] },
    { object: "whatsapp_business_account" },
    { object: "whatsapp_business_account", entry: "nope" },
    { object: "whatsapp_business_account", entry: [null, 1, { changes: [null, { field: "messages" }] }] },
    envelope({ metadata: {} }),
    envelope({ metadata: { phone_number_id: 12345 } }),
  ];
  for (const input of inputs) assertEquals(parseWebhook(input), []);
});

Deno.test("malformed messages and statuses are skipped, valid neighbours kept", () => {
  const [change] = parseWebhook(envelope({
    metadata: METADATA,
    messages: [
      null,
      { from: "966512345678", timestamp: "1760263200", type: "text", text: { body: "no id" } },
      { id: "wamid.no-from", timestamp: "1760263200", type: "text", text: { body: "x" } },
      { id: "wamid.bad-ts", from: "966512345678", timestamp: "yesterday", type: "text" },
      { id: { nested: true }, from: "966512345678", timestamp: "1760263200" },
      { id: "wamid.ok", from: "966512345678", timestamp: "1760263200", type: "text", text: { body: 5 } },
    ],
    statuses: [{ id: "wamid.x", status: "sent" }, {
      id: "wamid.y",
      status: "failed",
      timestamp: "1760263200",
      errors: [{ code: "131026" }, { code: 131026, title: "Message undeliverable" }],
    }],
  }));
  assertEquals(change?.messages.map((m) => [m.id, m.text, m.profileName]), [["wamid.ok", null, null]]);
  assertEquals(change?.statuses.length, 1);
  assertEquals(change?.statuses[0]?.errors, [{
    code: 131026,
    title: "Message undeliverable",
    message: null,
    details: null,
  }]);
});

Deno.test("arrays are capped at 50 items", () => {
  const messages = Array.from({ length: 80 }, (_, i) => ({
    from: "966512345678",
    id: `wamid.${i}`,
    timestamp: "1760263200",
    type: "text",
    text: { body: "x" },
  }));
  const [change] = parseWebhook(envelope({ metadata: METADATA, messages }));
  assertEquals(change?.messages.length, 50);
});

Deno.test("long text is truncated to the stored message limit, not dropped", () => {
  const [change] = parseWebhook(envelope({
    metadata: METADATA,
    messages: [{
      from: "966512345678",
      id: "wamid.long",
      timestamp: "1760263200",
      type: "text",
      text: { body: "a".repeat(6000) },
    }],
  }));
  assertEquals(change?.messages[0]?.text?.length, 4096);
});
