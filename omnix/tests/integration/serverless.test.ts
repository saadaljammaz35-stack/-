import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as createModel } from "@/app/api/ai/models/personal/route";
import { GET as listProviders } from "@/app/api/ai/providers/route";
import { POST as addText } from "@/app/api/ai/knowledge/text/route";
import { POST as search } from "@/app/api/ai/knowledge/search/route";
import { POST as saveMemory } from "@/app/api/ai/memory/route";
import { POST as chatStream } from "@/app/api/ai/chat/stream/route";
import { setEmbedderForTests } from "@/lib/ai/embeddings";
import { processDocument } from "@/lib/ai/rag/knowledge";
import { recallMemories } from "@/lib/ai/memory/memory";
import { setProviderOverrideForTests } from "@/lib/ai/providers/registry";
import { resetEnvCache } from "@/lib/config/env";
import { closePool, withUser } from "@/lib/db/pool";
import { call, jsonOf, ownerPool, readSse, registerUser } from "./helpers";
import { ScriptedProvider } from "./scripted-provider";

// A serverless deployment (Vercel): no model runs on the server, no embedding
// model, and the owner connects their own OpenAI-compatible provider. The
// provider itself is a test double here (no network); everything else —
// database, RLS, routes, keyword retrieval — is real.

const owner = ownerPool();
const saved = { emb: process.env.EMBEDDING_PROVIDER, onnx: process.env.OMNIX_LOCAL_ONNX_ENABLED, reg: process.env.OMNIX_REGISTRATION_OPEN };
let alice: Awaited<ReturnType<typeof registerUser>>;
let providerId: string;
let modelId: string;

beforeAll(async () => {
  process.env.EMBEDDING_PROVIDER = "none";
  process.env.OMNIX_LOCAL_ONNX_ENABLED = "false";
  resetEnvCache();
  setEmbedderForTests(undefined);
  alice = await registerUser(register, "Serverless Alice");
  const p = await withUser(alice.userId, (db) =>
    db.query(
      `INSERT INTO ai_model_providers (owner_id, workspace_id, provider_name, provider_type, endpoint)
       VALUES ($1, $2, 'Groq · test', 'openai_compatible', 'https://api.groq.com/openai/v1') RETURNING id`,
      [alice.userId, alice.workspaceId],
    ),
  );
  providerId = p.rows[0].id;
  setProviderOverrideForTests(providerId, new ScriptedProvider());
});

afterAll(async () => {
  setProviderOverrideForTests(providerId, undefined);
  for (const [k, v] of [["EMBEDDING_PROVIDER", saved.emb], ["OMNIX_LOCAL_ONNX_ENABLED", saved.onnx], ["OMNIX_REGISTRATION_OPEN", saved.reg]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetEnvCache();
  await owner.end();
  await closePool();
});

describe("model on the owner's own provider", () => {
  it("tells the client that the server has no model of its own", async () => {
    const res = await call(listProviders, { as: alice });
    expect(res.status).toBe(200);
    const j = await jsonOf<{ platformConfigured: boolean; providers: { id: string; scope: string }[] }>(res);
    expect(j.platformConfigured).toBe(false);
    expect(j.providers.find((p) => p.id === providerId)?.scope).toBe("personal");
  });

  it("refuses a model without a provider when none is configured", async () => {
    const res = await call(createModel, { as: alice, body: { displayName: "No provider AI" } });
    expect(res.status).toBe(503);
    expect((await jsonOf<{ error: { code: string } }>(res)).error.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("requires providerId and providerModel together", async () => {
    const res = await call(createModel, { as: alice, body: { displayName: "Half AI", providerId } });
    expect(res.status).toBe(422);
  });

  it("creates the model on the chosen provider and model name", async () => {
    const res = await call(createModel, { as: alice, body: { displayName: "Alice Cloud AI", providerId, providerModel: "openai/gpt-oss-120b", maxOutputTokens: 64 } });
    expect(res.status).toBe(201);
    const j = await jsonOf<{ profile: { id: string }; version: { providerId: string; providerModel: string; baseModel: string } }>(res);
    expect(j.version.providerId).toBe(providerId);
    expect(j.version.providerModel).toBe("openai/gpt-oss-120b");
    expect(j.version.baseModel).toBe("openai/gpt-oss-120b");
    modelId = j.profile.id;
  });

  it("does not let another user build a model on someone else's provider", async () => {
    const bob = await registerUser(register, "Serverless Bob");
    const res = await call(createModel, { as: bob, body: { displayName: "Bob AI", providerId, providerModel: "x" } });
    expect(res.status).toBe(404);
  });
});

describe("knowledge and memory without an embedding model", () => {
  let docId: string;

  it("stores chunks without vectors and finds them by keywords", async () => {
    const res = await call(addText, {
      as: alice,
      body: { title: "سياسة الإجازات", text: "سياسة الإجازات في شركة الواحة: يحصل كل موظف على ثلاثين يوم إجازة سنوية مدفوعة، وتُقدَّم طلبات الإجازة قبل أسبوعين." },
    });
    expect(res.status).toBe(201);
    docId = (await jsonOf<{ document: { id: string } }>(res)).document.id;
    const doc = await processDocument(alice.userId, docId);
    expect(doc.processingStatus).toBe("ready");
    const rows = await owner.query("SELECT embedding, embedding_model FROM ai_knowledge_chunks WHERE document_id = $1", [docId]);
    expect(rows.rowCount).toBeGreaterThan(0);
    expect(rows.rows.every((r) => r.embedding === null && r.embedding_model === null)).toBe(true);

    const hits = await call(search, { as: alice, body: { query: "كم يوم الإجازة السنوية؟", topK: 5 } });
    expect(hits.status).toBe(200);
    const results = (await jsonOf<{ results: { documentId: string; relevant: boolean; similarity: number | null }[] }>(hits)).results;
    expect(results[0]?.documentId).toBe(docId);
    expect(results[0]?.relevant).toBe(true);
    expect(results[0]?.similarity).toBeNull();
  });

  it("does not count one incidental shared word as relevant", async () => {
    const hits = await call(search, { as: alice, body: { query: "ما هي سياسة الخصوصية للتطبيق؟", topK: 5 } });
    const results = (await jsonOf<{ results: { documentId: string; relevant: boolean }[] }>(hits)).results;
    expect(results.filter((r) => r.relevant)).toEqual([]);
  });

  it("saves memories without vectors and recalls them by keywords", async () => {
    for (const [kind, content] of [["preference", "أفضّل الإجابات المختصرة"], ["fact", "مشروع النخيل يُسلَّم في شهر مارس"]] as const) {
      const res = await call(saveMemory, { as: alice, body: { kind, content } });
      expect(res.status).toBe(201);
    }
    const m = await withUser(alice.userId, (db) =>
      recallMemories(db, { userId: alice.userId, workspaceId: alice.workspaceId }, { query: "متى تسليم مشروع النخيل؟", modelProfileId: modelId, topK: 5, includeProject: true }),
    );
    expect(m.map((x) => x.content).sort()).toEqual(["أفضّل الإجابات المختصرة", "مشروع النخيل يُسلَّم في شهر مارس"].sort());
    const unrelated = await withUser(alice.userId, (db) =>
      recallMemories(db, { userId: alice.userId, workspaceId: alice.workspaceId }, { query: "اكتب قصيدة عن البحر", modelProfileId: modelId, topK: 5, includeProject: true }),
    );
    expect(unrelated.map((x) => x.content)).toEqual(["أفضّل الإجابات المختصرة"]);
  });

  it("answers in chat with the keyword-found source", async () => {
    const res = await call(chatStream, { as: alice, body: { message: "كم يوم الإجازة السنوية في شركة الواحة؟", modelProfileId: modelId } });
    expect(res.status).toBe(200);
    const events = await readSse(res);
    const meta = events.find((e) => e.event === "meta")!.data as { sources: { title: string }[]; model: { provider: string } };
    expect(meta.sources.map((s) => s.title)).toContain("سياسة الإجازات");
    const done = events.find((e) => e.event === "done")!.data as { message: { status: string; content: string } };
    expect(done.message.status).toBe("complete");
    expect(done.message.content.length).toBeGreaterThan(0);
  });
});

describe("closed registration", () => {
  it("refuses new accounts when OMNIX_REGISTRATION_OPEN=false", async () => {
    process.env.OMNIX_REGISTRATION_OPEN = "false";
    resetEnvCache();
    try {
      const res = await call(register, {
        body: { email: "late@example.test", password: "correct-horse-42", displayName: "Late" },
        headers: { "x-forwarded-for": "10.9.9.9" },
      });
      expect(res.status).toBe(403);
    } finally {
      process.env.OMNIX_REGISTRATION_OPEN = "true";
      resetEnvCache();
    }
  });
});
