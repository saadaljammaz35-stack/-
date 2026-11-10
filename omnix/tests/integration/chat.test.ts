import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as createModel, GET as listPersonal } from "@/app/api/ai/models/personal/route";
import { POST as chat } from "@/app/api/ai/chat/route";
import { POST as chatStream } from "@/app/api/ai/chat/stream/route";
import { GET as getConversation } from "@/app/api/ai/conversations/[id]/route";
import { GET as listConversations } from "@/app/api/ai/conversations/route";
import { POST as createKey } from "@/app/api/ai/api-keys/route";
import { POST as feedback } from "@/app/api/ai/messages/[id]/feedback/route";
import { PATCH as updateModel } from "@/app/api/ai/models/[id]/route";
import { closePool } from "@/lib/db/pool";
import { call, jsonOf, ownerPool, readSse, registerUser } from "./helpers";

// These tests run against a REAL open-weight model (Qwen2.5-0.5B-Instruct,
// ONNX, CPU) and a REAL PostgreSQL. Nothing here is mocked.

let alice: Awaited<ReturnType<typeof registerUser>>;
let bob: Awaited<ReturnType<typeof registerUser>>;
let modelId: string;
let versionId: string;
const owner = ownerPool();

beforeAll(async () => {
  alice = await registerUser(register, "Alice");
  bob = await registerUser(register, "Bob");
  const res = await call(createModel, {
    as: alice,
    body: { displayName: "Alice AI", description: "Test model", maxOutputTokens: 48, knowledgeMode: "off", memoryEnabled: false, temperature: 0 },
  });
  expect(res.status).toBe(201);
  const j = await jsonOf<{ profile: { id: string; slug: string }; version: { id: string; version: string; status: string; providerModel: string } }>(res);
  modelId = j.profile.id;
  versionId = j.version.id;
  expect(j.profile.slug).toBe("alice-ai");
  expect(j.version.version).toBe("1.0.0");
  expect(j.version.status).toBe("ready");
});

afterAll(async () => {
  await owner.end();
  await closePool();
});

describe("model identity", () => {
  it("lists the personal model with its first version", async () => {
    const j = await jsonOf<{ models: { id: string; displayName: string; versions: { version: string; baseModel: string }[] }[] }>(
      await call(listPersonal, { as: alice }),
    );
    expect(j.models).toHaveLength(1);
    expect(j.models[0]!.displayName).toBe("Alice AI");
    expect(j.models[0]!.versions[0]!.baseModel).toBe("Qwen/Qwen2.5-0.5B-Instruct");
  });

  it("does not show Alice's model to Bob", async () => {
    const j = await jsonOf<{ models: unknown[] }>(await call(listPersonal, { as: bob }));
    expect(j.models).toHaveLength(0);
  });
});

describe("chat with a real model", () => {
  let conversationId: string;
  let assistantId: string;

  it("streams meta → delta → done over SSE and persists the turn", async () => {
    const res = await call(chatStream, { as: alice, body: { message: "Reply with one short English sentence greeting me." } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const events = await readSse(res);
    const kinds = events.map((e) => e.event);
    expect(kinds[0]).toBe("meta");
    expect(kinds.filter((k) => k === "delta").length).toBeGreaterThan(0);
    expect(kinds.at(-1)).toBe("done");

    const meta = events[0]!.data as { conversationId: string; assistantMessageId: string; model: { displayName: string; version: string; preview: boolean } };
    expect(meta.model.displayName).toBe("Alice AI");
    expect(meta.model.version).toBe("1.0.0");
    expect(meta.model.preview).toBe(true); // nothing deployed yet
    conversationId = meta.conversationId;
    assistantId = meta.assistantMessageId;

    const streamed = events.filter((e) => e.event === "delta").map((e) => e.data.text).join("");
    const done = events.at(-1)!.data as { message: { content: string; status: string; usage: { inputTokens: number; outputTokens: number; source: string } } };
    expect(done.message.status).toBe("complete");
    expect(done.message.content.length).toBeGreaterThan(0);
    expect(streamed).toBe(done.message.content);
    // Counted by the model's own tokenizer.
    expect(done.message.usage.source).toBe("provider");
    expect(done.message.usage.inputTokens).toBeGreaterThan(20);
    expect(done.message.usage.outputTokens).toBeGreaterThan(0);

    const db = await owner.query("SELECT status, content FROM ai_messages WHERE id = $1", [assistantId]);
    expect(db.rows[0].status).toBe("complete");
    expect(db.rows[0].content).toBe(done.message.content);
    const usage = await owner.query("SELECT * FROM ai_usage_events WHERE model_version_id = $1 AND operation = 'chat'", [versionId]);
    expect(usage.rowCount).toBe(1);
    expect(usage.rows[0].usage_source).toBe("provider");
    expect(usage.rows[0].estimated_cost).toBeNull(); // no price configured → not invented
  });

  it("restores the conversation", async () => {
    const j = await jsonOf<{ messages: { role: string; content: string }[] }>(
      await call(getConversation, { as: alice, params: { id: conversationId } }),
    );
    expect(j.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    const list = await jsonOf<{ conversations: { id: string }[] }>(await call(listConversations, { as: alice }));
    expect(list.conversations.map((c) => c.id)).toContain(conversationId);
  });

  it("continues the conversation with history (non-streaming endpoint)", async () => {
    const res = await call(chat, { as: alice, body: { conversationId, message: "Now say it in Arabic." } });
    expect(res.status).toBe(200);
    const j = await jsonOf<{ conversationId: string; message: { content: string; status: string } }>(res);
    expect(j.conversationId).toBe(conversationId);
    expect(j.message.status).toBe("complete");
  });

  it("regenerates an answer as a new message linked to the old one", async () => {
    const res = await call(chat, { as: alice, body: { conversationId, regenerateMessageId: assistantId } });
    expect(res.status).toBe(200);
    const j = await jsonOf<{ message: { id: string } }>(res);
    const row = await owner.query("SELECT parent_message_id FROM ai_messages WHERE id = $1", [j.message.id]);
    expect(row.rows[0].parent_message_id).toBe(assistantId);
  });

  it("records a rating", async () => {
    expect((await call(feedback, { as: alice, params: { id: assistantId }, body: { rating: 1 } })).status).toBe(200);
    const row = await owner.query("SELECT rating FROM ai_messages WHERE id = $1", [assistantId]);
    expect(row.rows[0].rating).toBe(1);
  });

  it("updates model settings through the identity layer", async () => {
    const res = await call(updateModel, { as: alice, method: "PATCH", params: { id: modelId }, body: { maxOutputTokens: 400 } });
    expect(res.status).toBe(200);
    const j = await jsonOf<{ model: { maxOutputTokens: number; displayName: string } }>(res);
    expect(j.model.maxOutputTokens).toBe(400);
    expect(j.model.displayName).toBe("Alice AI");
  });

  it("stops generating when the client disconnects and saves the partial answer as cancelled", async () => {
    const ac = new AbortController();
    const req = new Request("http://localhost/api/ai/chat/stream", {
      method: "POST",
      headers: { host: "localhost", origin: "http://localhost", cookie: alice.cookie, "content-type": "application/json" },
      body: JSON.stringify({ conversationId, message: "Write a very long story about the desert, at least 300 words." }),
      signal: ac.signal,
    });
    const res = await chatStream(req, { params: Promise.resolve({}) });
    const reader = res.body!.getReader();
    let buf = "";
    let assistantMessageId = "";
    while (!buf.includes("event: delta")) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += new TextDecoder().decode(value);
      assistantMessageId ||= /"assistantMessageId":"([0-9a-f-]+)"/.exec(buf)?.[1] ?? "";
    }
    ac.abort();
    await reader.cancel().catch(() => {});
    let status = "streaming";
    for (let i = 0; i < 100 && status === "streaming"; i++) {
      await new Promise((r) => setTimeout(r, 100));
      status = (await owner.query("SELECT status FROM ai_messages WHERE id = $1", [assistantMessageId])).rows[0]?.status;
    }
    expect(status).toBe("cancelled");
  });

  it("hides Alice's conversation from Bob", async () => {
    const res = await call(getConversation, { as: bob, params: { id: conversationId } });
    expect(res.status).toBe(404);
    const res2 = await call(chat, { as: bob, body: { conversationId, message: "hi" } });
    expect(res2.status).toBe(404);
    const res3 = await call(chat, { as: bob, body: { modelProfileId: modelId, message: "hi" } });
    expect(res3.status).toBe(404);
  });
});

describe("access control", () => {
  it("rejects unauthenticated requests", async () => {
    expect((await call(chat, { body: { message: "hi" } })).status).toBe(401);
  });

  it("rejects cross-origin cookie writes (CSRF)", async () => {
    const res = await call(chat, { as: alice, body: { message: "hi" }, headers: { origin: "https://evil.example" } });
    expect(res.status).toBe(403);
  });

  it("enforces API key scopes and requires a deployed version for external access", async () => {
    const k = await jsonOf<{ token: string }>(await call(createKey, { as: alice, body: { name: "read-only", scopes: ["models:read"] } }));
    const noScope = await call(chat, { as: { apiKey: k.token }, body: { message: "hi" } });
    expect(noScope.status).toBe(403);

    const k2 = await jsonOf<{ token: string }>(await call(createKey, { as: alice, body: { name: "chat", scopes: ["chat"] } }));
    const notDeployed = await call(chat, { as: { apiKey: k2.token }, body: { message: "hi" } });
    expect(notDeployed.status).toBe(412);

    const bogus = await call(chat, { as: { apiKey: "omx_aaaaaaaa_" + "x".repeat(43) }, body: { message: "hi" } });
    expect(bogus.status).toBe(401);
  });

  it("refuses API-key access to session-only operations", async () => {
    const k = await jsonOf<{ token: string }>(await call(createKey, { as: alice, body: { name: "all", scopes: ["chat", "models:read"] } }));
    const res = await call(createModel, { as: { apiKey: k.token }, body: { displayName: "X" } });
    expect(res.status).toBe(403);
  });
});
