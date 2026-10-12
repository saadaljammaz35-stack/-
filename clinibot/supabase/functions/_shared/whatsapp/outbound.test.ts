import { assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import type { IntegrationRow } from "./integration.ts";
import { GraphError } from "./graph.ts";
import { graphErrorCode, loadSender, sendAndRecord, templateRecord } from "./outbound.ts";
import { DEFAULTS, FakeDb, fakeFetch, jsonResponse, saveTestCredentials, setTestEnv } from "./testing.ts";

setTestEnv();

const ORG = "00000000-0000-4000-8000-00000000000a";
const CONVERSATION = "10000000-0000-4000-8000-000000000002";
const INTEGRATION = {
  ...DEFAULTS.integration_settings!(),
  id: "20000000-0000-4000-8000-000000000001",
  organization_id: ORG,
  status: "connected",
  phone_number_id: "106540352242922",
} as unknown as IntegrationRow;

async function sender(db: FakeDb) {
  await saveTestCredentials(db, INTEGRATION as unknown as Record<string, unknown>, "EAAGoutboundTOKEN000000000");
  const loaded = await loadSender(db.db, ORG);
  if (!loaded) throw new Error("expected a sender");
  return loaded;
}

Deno.test("an unexpected error after the pending row is written marks it failed and re-throws", async () => {
  const db = new FakeDb({ tables: { integration_settings: [{ ...INTEGRATION }] } });
  const s = await sender(db);
  await assertRejects(() =>
    sendAndRecord(db.db, s, {
      conversationId: CONVERSATION,
      to: "not-a-number",
      sender: "assistant",
      content: { kind: "text", body: "hi" },
      fetchImpl: fakeFetch().fetch,
      now: new Date(),
    }), TypeError);
  assertEquals(db.tables.messages?.map((m) => [m.status, m.error_code]), [["failed", "internal_error"]]);
});

Deno.test("assistant messages are recorded with their sender and Meta's id", async () => {
  const db = new FakeDb({ tables: { integration_settings: [{ ...INTEGRATION }] } });
  const s = await sender(db);
  const result = await sendAndRecord(db.db, s, {
    conversationId: CONVERSATION,
    to: "+966512345678",
    sender: "assistant",
    content: { kind: "text", body: "hi" },
    fetchImpl: fakeFetch(jsonResponse({ messages: [{ id: "wamid.A" }] })).fetch,
    now: new Date(),
  });
  assertEquals(result.error, null);
  assertEquals([result.message.sender, result.message.status], ["assistant", "sent"]);
  assertEquals(db.tables.messages?.[0]?.wa_message_id, "wamid.A");
});

Deno.test("loadSender is null unless the integration can send and credentials exist", async () => {
  const none = new FakeDb({ tables: { integration_settings: [{ ...INTEGRATION }] } });
  assertEquals(await loadSender(none.db, ORG), null);
  const disconnected = new FakeDb({ tables: { integration_settings: [{ ...INTEGRATION, status: "disconnected" }] } });
  await saveTestCredentials(disconnected, INTEGRATION as unknown as Record<string, unknown>, "EAAGtoken00000000000");
  assertEquals(await loadSender(disconnected.db, ORG), null);
});

Deno.test("template records and error codes", () => {
  assertEquals(templateRecord("follow_up", "ar", []), "[template follow_up (ar)]");
  assertEquals(templateRecord("x", "en_US", ["a", "b"]), "[template x (en_US)] a | b");
  assertEquals(graphErrorCode(new GraphError(400, 131047, null, null, null)), "131047");
  assertEquals(graphErrorCode(new GraphError(0, null, null, null, null)), "network_error");
  assertEquals(graphErrorCode(new GraphError(503, null, null, null, null)), "http_503");
});
