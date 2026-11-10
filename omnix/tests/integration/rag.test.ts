import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as createModel } from "@/app/api/ai/models/personal/route";
import { PATCH as updateModel } from "@/app/api/ai/models/[id]/route";
import { POST as upload } from "@/app/api/ai/knowledge/upload/route";
import { POST as addText } from "@/app/api/ai/knowledge/text/route";
import { POST as search } from "@/app/api/ai/knowledge/search/route";
import { GET as listDocs } from "@/app/api/ai/knowledge/route";
import { DELETE as deleteDoc, GET as getDoc } from "@/app/api/ai/knowledge/[id]/route";
import { POST as saveMemory, GET as listMemories } from "@/app/api/ai/memory/route";
import { DELETE as deleteMemory } from "@/app/api/ai/memory/[id]/route";
import { POST as chatStream } from "@/app/api/ai/chat/stream/route";
import { processDocument } from "@/lib/ai/rag/knowledge";
import { closePool } from "@/lib/db/pool";
import { call, jsonOf, ownerPool, readSse, registerUser } from "./helpers";

// Real embedder (intfloat/multilingual-e5-small, ONNX) and real model.

const fx = (f: string) => readFileSync(path.resolve(import.meta.dirname, "../fixtures", f));
const owner = ownerPool();
let alice: Awaited<ReturnType<typeof registerUser>>;
let bob: Awaited<ReturnType<typeof registerUser>>;
let modelId: string;
const docs: Record<string, string> = {};

async function uploadFile(as: typeof alice, filename: string, data: Uint8Array, extra: Record<string, string> = {}) {
  const form = new FormData();
  form.set("file", new File([data], filename));
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  return call(upload, { as, form });
}

async function uploadAndProcess(filename: string, extra: Record<string, string> = {}) {
  const res = await uploadFile(alice, filename, fx(filename), extra);
  expect(res.status).toBe(201);
  const { document } = await jsonOf<{ document: { id: string } }>(res);
  const processed = await processDocument(alice.userId, document.id);
  expect(processed.processingStatus).toBe("ready");
  expect(processed.chunkCount).toBeGreaterThan(0);
  docs[filename] = document.id;
  return processed;
}

async function searchFor(as: typeof alice, query: string) {
  const res = await call(search, { as, body: { query, topK: 5 } });
  expect(res.status).toBe(200);
  return (await jsonOf<{ results: { title: string; documentId: string; page: number | null; similarity: number | null; relevant: boolean; keywordRank: number | null }[] }>(res)).results;
}

beforeAll(async () => {
  alice = await registerUser(register, "Alice");
  bob = await registerUser(register, "Bob");
  const res = await call(createModel, { as: alice, body: { displayName: "Alice Knowledge AI", maxOutputTokens: 64, temperature: 0, memoryEnabled: true } });
  modelId = (await jsonOf<{ profile: { id: string } }>(res)).profile.id;
});

afterAll(async () => {
  await owner.end();
  await closePool();
});

describe("ingestion pipeline", () => {
  it("processes Markdown (Arabic) into embedded chunks", async () => {
    const d = await uploadAndProcess("oasis-project.md", { tags: "projects,archive", category: "projects" });
    expect(d.embeddingModel).toBe("intfloat/multilingual-e5-small");
    const rows = await owner.query("SELECT embedding_dims, search_text, metadata FROM ai_knowledge_chunks WHERE document_id = $1", [d.id]);
    expect(rows.rows.every((r) => r.embedding_dims === 384)).toBe(true);
    // Arabic normalisation + light stemming in the keyword index: "المشروع" → "مشروع".
    expect(rows.rows.some((r) => / مشروع /.test(` ${r.search_text} `))).toBe(true);
    expect(rows.rows.some((r) => r.metadata.heading)).toBe(true);
  });

  it("processes PDF with page numbers", async () => {
    await uploadAndProcess("falcon-manual.pdf");
    const rows = await owner.query("SELECT metadata FROM ai_knowledge_chunks WHERE document_id = $1", [docs["falcon-manual.pdf"]]);
    expect(rows.rows[0].metadata.page).toBe(1);
  });

  it("processes DOCX, JSON and JSONL", async () => {
    await uploadAndProcess("palm-leave-policy.docx");
    await uploadAndProcess("router.json");
    await uploadAndProcess("router-faq.jsonl");
  });

  it("accepts manually entered text", async () => {
    const res = await call(addText, { as: alice, body: { title: "Office notes", text: "The Riyadh office wifi network is called Sahab-5G." } });
    expect(res.status).toBe(201);
    const { document } = await jsonOf<{ document: { id: string } }>(res);
    await processDocument(alice.userId, document.id);
    docs.notes = document.id;
  });

  it("rejects files by content, not by name", async () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    expect((await uploadFile(alice, "invoice.pdf", exe)).status).toBe(415);
    expect((await uploadFile(alice, "notes.txt", exe)).status).toBe(415);
    expect((await uploadFile(alice, "tool.exe", exe)).status).toBe(415);
    expect((await uploadFile(alice, "broken.json", new TextEncoder().encode("{not json"))).status).toBe(415);
    expect((await uploadFile(alice, "renamed.docx", fx("falcon-manual.pdf"))).status).toBe(415);
  });

  it("refuses duplicate uploads in the same workspace", async () => {
    const res = await uploadFile(alice, "copy.md", fx("oasis-project.md"));
    expect(res.status).toBe(409);
  });

  it("lists documents with filters", async () => {
    const all = await jsonOf<{ documents: unknown[] }>(await call(listDocs, { as: alice }));
    expect(all.documents.length).toBe(6);
    const tagged = await jsonOf<{ documents: { title: string }[] }>(await call(listDocs, { as: alice, path: "/api/ai/knowledge?tag=projects" }));
    expect(tagged.documents.map((d) => d.title)).toEqual(["oasis-project"]);
  });
});

describe("retrieval", () => {
  it("finds Arabic content for an Arabic question and cites its source", async () => {
    const r = await searchFor(alice, "ما هو رمز مشروع الواحة؟");
    expect(r[0]!.documentId).toBe(docs["oasis-project.md"]);
    expect(r[0]!.relevant).toBe(true);
  });

  it("finds English content inside a PDF, with the page", async () => {
    const r = await searchFor(alice, "How often must the Falcon cooling loop be inspected?");
    expect(r[0]!.documentId).toBe(docs["falcon-manual.pdf"]);
    expect(r[0]!.page).toBe(1);
  });

  it("matches across languages (English question, bilingual DOCX)", async () => {
    const r = await searchFor(alice, "annual leave days for employees");
    expect(r[0]!.documentId).toBe(docs["palm-leave-policy.docx"]);
  });

  it("marks nothing relevant for an unrelated question", async () => {
    const r = await searchFor(alice, "What is the recipe for chocolate cake?");
    // Logged so the calibrated threshold can be reviewed against real scores.
    console.info("unrelated query similarities:", r.map((x) => x.similarity?.toFixed(3)).join(", "));
    expect(r.filter((x) => x.relevant)).toHaveLength(0);
  });

  it("isolates workspaces: Bob cannot find or open Alice's documents", async () => {
    const r = await searchFor(bob, "رمز مشروع الواحة");
    expect(r).toHaveLength(0);
    expect((await call(getDoc, { as: bob, params: { id: docs["oasis-project.md"]! } })).status).toBe(404);
    expect((await call(deleteDoc, { as: bob, method: "DELETE", params: { id: docs["oasis-project.md"]! } })).status).toBe(404);
  });
});

describe("grounded chat", () => {
  it("answers from the knowledge base with sources", async () => {
    const res = await call(chatStream, { as: alice, body: { modelProfileId: modelId, message: "ما هو رمز مشروع الواحة؟" } });
    const events = await readSse(res);
    const meta = events.find((e) => e.event === "meta")!.data as { sources: { id: string; documentId: string; title: string }[] };
    expect(meta.sources.length).toBeGreaterThan(0);
    expect(meta.sources[0]!.documentId).toBe(docs["oasis-project.md"]);
    const done = events.find((e) => e.event === "done")!.data as { message: { content: string } };
    console.info("grounded answer:", done.message.content);
    expect(done.message.content).toContain("QX-4471");
  });

  it("in strict mode, says 'not found' without calling the model when nothing is relevant", async () => {
    await call(updateModel, { as: alice, method: "PATCH", params: { id: modelId }, body: { knowledgeMode: "strict" } });
    const res = await call(chatStream, { as: alice, body: { modelProfileId: modelId, message: "What is the recipe for chocolate cake?" } });
    const events = await readSse(res);
    const meta = events.find((e) => e.event === "meta")!.data as { sources: unknown[] };
    expect(meta.sources).toHaveLength(0);
    const done = events.find((e) => e.event === "done")!.data as { message: { content: string; finishReason: string; usage: { outputTokens: number } } };
    expect(done.message.finishReason).toBe("no_relevant_source");
    expect(done.message.content).toMatch(/couldn't find this in your knowledge base/);
    expect(done.message.usage.outputTokens).toBe(0);
    await call(updateModel, { as: alice, method: "PATCH", params: { id: modelId }, body: { knowledgeMode: "assist" } });
  });

  it("deleting a document removes its chunks", async () => {
    expect((await call(deleteDoc, { as: alice, method: "DELETE", params: { id: docs.notes! } })).status).toBe(200);
    const left = await owner.query("SELECT count(*)::int AS n FROM ai_knowledge_chunks WHERE document_id = $1", [docs.notes]);
    expect(left.rows[0].n).toBe(0);
  });

  it("uploads a new revision of a document", async () => {
    const res = await uploadFile(alice, "oasis-v2.md", new TextEncoder().encode("# مشروع الواحة\n\nرمز مشروع الواحة الجديد هو ZK-9002."), {
      replaceDocumentId: docs["oasis-project.md"]!,
    });
    expect(res.status).toBe(201);
    const d = await processDocument(alice.userId, docs["oasis-project.md"]!);
    expect(d.revision).toBe(2);
    const r = await searchFor(alice, "رمز مشروع الواحة");
    expect(r[0]!.documentId).toBe(docs["oasis-project.md"]);
  });
});

describe("memory", () => {
  it("saves explicit memories and refuses secrets", async () => {
    const ok = await call(saveMemory, { as: alice, body: { kind: "preference", content: "Prefers short answers with bullet points." } });
    expect(ok.status).toBe(201);
    const bad = await call(saveMemory, { as: alice, body: { kind: "fact", content: "My password: Hunter2-secret" } });
    expect(bad.status).toBe(422);
    const card = await call(saveMemory, { as: alice, body: { kind: "fact", content: "Card 4111 1111 1111 1111" } });
    expect(card.status).toBe(422);
  });

  it("recalls memories in chat and keeps them per user", async () => {
    const res = await call(chatStream, { as: alice, body: { modelProfileId: modelId, message: "How should you format answers for me?" } });
    const meta = (await readSse(res)).find((e) => e.event === "meta")!.data as { memoriesUsed: number };
    expect(meta.memoriesUsed).toBeGreaterThan(0);
    const bobs = await jsonOf<{ memories: unknown[] }>(await call(listMemories, { as: bob }));
    expect(bobs.memories).toHaveLength(0);
  });

  it("lets the user review and delete memories", async () => {
    const list = await jsonOf<{ memories: { id: string }[] }>(await call(listMemories, { as: alice }));
    expect(list.memories).toHaveLength(1);
    expect((await call(deleteMemory, { as: bob, method: "DELETE", params: { id: list.memories[0]!.id } })).status).toBe(404);
    expect((await call(deleteMemory, { as: alice, method: "DELETE", params: { id: list.memories[0]!.id } })).status).toBe(200);
  });
});
