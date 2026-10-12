import { assert, assertEquals, assertInstanceOf, assertRejects } from "jsr:@std/assert@1.0.13";
import { ConfigError } from "../env.ts";
import {
  getPhoneNumberInfo,
  type GraphConfig,
  GraphError,
  graphErrorSummary,
  sendTemplate,
  sendText,
  subscribeApp,
} from "./graph.ts";
import { fakeFetch, jsonResponse, metaError, setTestEnv } from "./testing.ts";

setTestEnv();

const TOKEN = "EAAGtestTOKEN1234567890abcdefXYZ";

function cfg(fetchImpl: typeof fetch, extra: Partial<GraphConfig> = {}): GraphConfig {
  return { accessToken: TOKEN, phoneNumberId: "106540352242922", fetchImpl, ...extra };
}

async function graphError(promise: Promise<unknown>): Promise<GraphError> {
  try {
    await promise;
  } catch (error) {
    assertInstanceOf(error, GraphError);
    return error;
  }
  throw new Error("expected a GraphError");
}

Deno.test("sendText posts the documented payload with a bearer token and returns the wamid", async () => {
  const fake = fakeFetch(jsonResponse({
    messaging_product: "whatsapp",
    contacts: [{ input: "966512345678", wa_id: "966512345678" }],
    messages: [{ id: "wamid.HBgMOTY2NTEy" }],
  }));
  const result = await sendText(cfg(fake.fetch), "+966512345678", "مرحباً");
  assertEquals(result, { messageId: "wamid.HBgMOTY2NTEy" });
  const call = fake.calls[0]!;
  assertEquals(call.method, "POST");
  assertEquals(call.url, "https://graph.facebook.com/v26.0/106540352242922/messages");
  assertEquals(call.headers.get("authorization"), `Bearer ${TOKEN}`);
  assertEquals(call.headers.get("content-type"), "application/json");
  assertEquals(call.body, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: "966512345678",
    type: "text",
    text: { preview_url: false, body: "مرحباً" },
  });
});

Deno.test("sendTemplate sends body parameters in order", async () => {
  const fake = fakeFetch(jsonResponse({ messages: [{ id: "wamid.T", message_status: "accepted" }] }));
  const result = await sendTemplate(cfg(fake.fetch), "966512345678", {
    name: "appointment_confirmed",
    language: "ar",
    bodyParams: ["سارة", "الثلاثاء، 20 أكتوبر 2026", "4:30 م"],
  });
  assertEquals(result.messageId, "wamid.T");
  assertEquals(fake.calls[0]?.body, {
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
});

Deno.test("template parameters are normalised to what Meta accepts", async () => {
  const fake = fakeFetch(jsonResponse({ messages: [{ id: "w" }] }));
  await sendTemplate(cfg(fake.fetch), "966512345678", {
    name: "t",
    language: "en",
    bodyParams: ["Sara\nAhmed", "a\t\tb", "x         y"],
  });
  const body = fake.calls[0]?.body as { template: { components: { parameters: { text: string }[] }[] } };
  assertEquals(body.template.components[0]?.parameters.map((p) => p.text), ["Sara Ahmed", "a b", "x    y"]);
});

Deno.test("a template without parameters sends no components", async () => {
  const fake = fakeFetch(jsonResponse({ messages: [{ id: "w" }] }));
  await sendTemplate(cfg(fake.fetch), "966512345678", { name: "hello_world", language: "en_US", bodyParams: [] });
  assertEquals((fake.calls[0]?.body as { template: { components: unknown[] } }).template.components, []);
});

Deno.test("the Graph version comes from WHATSAPP_GRAPH_VERSION or the config", async () => {
  Deno.env.set("WHATSAPP_GRAPH_VERSION", "v27.0");
  try {
    const fake = fakeFetch(jsonResponse({ messages: [{ id: "w" }] }), jsonResponse({ messages: [{ id: "w" }] }));
    await sendText(cfg(fake.fetch), "966512345678", "x");
    await sendText(cfg(fake.fetch, { version: "v25.0" }), "966512345678", "x");
    assert(fake.calls[0]?.url.startsWith("https://graph.facebook.com/v27.0/"));
    assert(fake.calls[1]?.url.startsWith("https://graph.facebook.com/v25.0/"));
  } finally {
    Deno.env.delete("WHATSAPP_GRAPH_VERSION");
  }
});

Deno.test("a malformed Graph version is a configuration error, not a request", async () => {
  Deno.env.set("WHATSAPP_GRAPH_VERSION", "v26.0/../../evil");
  try {
    const fake = fakeFetch();
    await assertRejects(() => sendText(cfg(fake.fetch), "966512345678", "x"), ConfigError);
    assertEquals(fake.calls.length, 0);
  } finally {
    Deno.env.delete("WHATSAPP_GRAPH_VERSION");
  }
});

Deno.test("131047 is reported as a closed service window", async () => {
  const fake = fakeFetch(
    metaError(131047, "Re-engagement message", 400, "More than 24 hours have passed since the customer last replied."),
  );
  const error = await graphError(sendText(cfg(fake.fetch), "966512345678", "x"));
  assertEquals(error.status, 400);
  assertEquals(error.code, 131047);
  assertEquals(error.subcode, 2494010);
  assertEquals(error.fbtraceId, "AbCdEfGh123");
  assert(error.windowClosed);
  assertEquals(error.authFailed, false);
  assertEquals(error.recipientUnavailable, false);
  assert(error.metaMessage?.includes("Re-engagement message"));
  assert(error.metaMessage?.includes("24 hours"));
});

Deno.test("190 and HTTP 401 are reported as authentication failures", async () => {
  const fake = fakeFetch(
    metaError(190, "Error validating access token: Session has expired.", 400),
    jsonResponse({ error: { message: "Unauthorized", code: 0 } }, 401),
  );
  assert((await graphError(sendText(cfg(fake.fetch), "966512345678", "x"))).authFailed);
  assert((await graphError(sendText(cfg(fake.fetch), "966512345678", "x"))).authFailed);
});

Deno.test("131026 and 131030 mean the recipient cannot receive messages", async () => {
  const fake = fakeFetch(
    metaError(131026, "Message undeliverable"),
    metaError(131030, "Recipient not in allowed list"),
  );
  assert((await graphError(sendText(cfg(fake.fetch), "966512345678", "x"))).recipientUnavailable);
  assert((await graphError(sendText(cfg(fake.fetch), "966512345678", "x"))).recipientUnavailable);
});

Deno.test("a token echoed back by Meta is scrubbed from the error", async () => {
  const fake = fakeFetch(metaError(190, `Malformed access token ${TOKEN}`, 400, `token ${TOKEN} rejected`));
  const error = await graphError(sendText(cfg(fake.fetch), "966512345678", "x"));
  for (const text of [error.message, error.metaMessage ?? "", graphErrorSummary(error), JSON.stringify(error)]) {
    assertEquals(text.includes(TOKEN), false, text);
    assertEquals(text.includes("EAAG"), false, text);
  }
  assert(error.metaMessage?.includes("[redacted]"));
});

Deno.test("timeouts and network failures become GraphError status 0 without the token", async () => {
  const fake = fakeFetch(
    new DOMException("Signal timed out.", "TimeoutError"),
    new TypeError(`error sending request: Authorization: Bearer ${TOKEN}`),
  );
  const timeout = await graphError(sendText(cfg(fake.fetch), "966512345678", "x"));
  assertEquals(timeout.status, 0);
  assertEquals(timeout.code, null);
  assertEquals(timeout.metaMessage, "Request to Meta timed out");
  const network = await graphError(sendText(cfg(fake.fetch), "966512345678", "x"));
  assertEquals(network.status, 0);
  assertEquals(network.metaMessage, "Could not connect to Meta");
  assertEquals(JSON.stringify([network, network.message, network.metaMessage]).includes(TOKEN), false);
  assertEquals(graphErrorSummary(network), "Meta could not be reached: Could not connect to Meta");
});

Deno.test("every request carries a timeout signal", async () => {
  let signal: AbortSignal | null | undefined;
  const impl = ((_input: string, init?: RequestInit) => {
    signal = init?.signal;
    return Promise.resolve(jsonResponse({ messages: [{ id: "w" }] }));
  }) as typeof fetch;
  await sendText(cfg(impl), "966512345678", "x");
  assertInstanceOf(signal, AbortSignal);
});

Deno.test("non-JSON errors, 5xx and a success without a message id are failures", async () => {
  const fake = fakeFetch(
    new Response("<html>Bad gateway</html>", { status: 502 }),
    jsonResponse({ messages: [] }),
    jsonResponse({ error: { message: "Unsupported post request", code: 100 } }, 200),
  );
  const gateway = await graphError(sendText(cfg(fake.fetch), "966512345678", "x"));
  assertEquals([gateway.status, gateway.code, gateway.metaMessage], [502, null, null]);
  const noId = await graphError(sendText(cfg(fake.fetch), "966512345678", "x"));
  assertEquals(noId.metaMessage, "Meta did not return a message id");
  const errorWith200 = await graphError(sendText(cfg(fake.fetch), "966512345678", "x"));
  assertEquals(errorWith200.code, 100);
});

Deno.test("recipients and ids are validated before any request", async () => {
  const fake = fakeFetch();
  await assertRejects(() => sendText(cfg(fake.fetch), "not-a-number", "x"), TypeError);
  await assertRejects(() => sendText(cfg(fake.fetch, { phoneNumberId: "123/../me" }), "966512345678", "x"), TypeError);
  assertEquals(fake.calls.length, 0);
});

Deno.test("getPhoneNumberInfo reads the documented fields", async () => {
  const fake = fakeFetch(jsonResponse({
    display_phone_number: "+966 50 000 0001",
    verified_name: "عيادة الابتسامة",
    quality_rating: "GREEN",
    id: "106540352242922",
  }));
  const info = await getPhoneNumberInfo(cfg(fake.fetch));
  assertEquals(info, {
    displayPhoneNumber: "+966 50 000 0001",
    verifiedName: "عيادة الابتسامة",
    qualityRating: "GREEN",
  });
  assertEquals(fake.calls[0]?.method, "GET");
  assertEquals(
    fake.calls[0]?.url,
    "https://graph.facebook.com/v26.0/106540352242922?fields=display_phone_number,verified_name,quality_rating",
  );
});

Deno.test("subscribeApp posts to the WABA and reports Meta's success flag", async () => {
  const fake = fakeFetch(jsonResponse({ success: true }), jsonResponse({ success: false }), metaError(200, "Denied"));
  const base = { accessToken: TOKEN, wabaId: "102290129340398", fetchImpl: fake.fetch };
  assertEquals(await subscribeApp(base), true);
  assertEquals(await subscribeApp(base), false);
  await assertRejects(() => subscribeApp(base), GraphError);
  assertEquals(fake.calls[0]?.url, "https://graph.facebook.com/v26.0/102290129340398/subscribed_apps");
  assertEquals(fake.calls[0]?.method, "POST");
});
