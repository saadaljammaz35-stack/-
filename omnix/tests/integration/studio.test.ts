import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as createModel } from "@/app/api/ai/models/personal/route";
import { GET as listApps, POST as createApp } from "@/app/api/ai/apps/route";
import { DELETE as deleteApp, GET as getApp } from "@/app/api/ai/apps/[id]/route";
import { POST as generate } from "@/app/api/ai/apps/[id]/generate/route";
import { GET as getVersion } from "@/app/api/ai/apps/[id]/versions/[versionId]/route";
import { POST as restore } from "@/app/api/ai/apps/[id]/restore/route";
import { DELETE as unpublish, POST as publish } from "@/app/api/ai/apps/[id]/publish/route";
import { GET as previewRoute } from "@/app/preview/[token]/[[...path]]/route";
import { GET as publicRoute } from "@/app/p/[slug]/[[...path]]/route";
import { setProviderOverrideForTests } from "@/lib/ai/providers/registry";
import type { GenerateRequest, GenerateResult, ModelProvider, StreamEvent } from "@/lib/ai/providers/types";
import { closePool } from "@/lib/db/pool";
import { call, jsonOf, ownerPool, readSse, registerUser } from "./helpers";

// The model is a test double that answers with scripted file blocks (no
// network, no real model). Routes, parsing, versions, RLS and serving are real.

class StudioScript implements ModelProvider {
  readonly type = "openai_compatible" as const;
  readonly name = "studio-script";
  queue: string[] = [];
  lastRequest: GenerateRequest | null = null;
  async *stream(req: GenerateRequest): AsyncIterable<StreamEvent> {
    this.lastRequest = req;
    const text = this.queue.shift() ?? "Nothing to do.";
    // Small uneven chunks, the way tokens arrive.
    for (let i = 0; i < text.length; i += 7) yield { type: "delta", text: text.slice(i, i + 7) };
    yield {
      type: "done",
      result: { text, toolCalls: [], finishReason: "stop", usage: { inputTokens: 100, outputTokens: 50, source: "provider" }, model: req.model, latencyMs: 1, firstTokenMs: 1 },
    };
  }
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    let last: GenerateResult | null = null;
    for await (const ev of this.stream(req)) if (ev.type === "done") last = ev.result;
    return last!;
  }
  async healthCheck() {
    return { status: "healthy" as const, latencyMs: 1 };
  }
  async getCapabilities() {
    return { streaming: true, toolCalling: false, vision: false, embeddings: false, loadUnload: false, loraAdapters: false };
  }
  async getModelInfo(model: string) {
    return { id: model, contextLength: 32_768 };
  }
  async listModels() {
    return [{ id: "script", contextLength: 32_768 }];
  }
  async loadModel() {}
  async unloadModel() {}
}

const owner = ownerPool();
const script = new StudioScript();
let alice: Awaited<ReturnType<typeof registerUser>>;
let bob: Awaited<ReturnType<typeof registerUser>>;
let providerId: string;
let appId: string;
let v1: { id: string; previewUrl: string };

const V1 = `سأبني عدادًا بسيطًا.
<omnix-file path="index.html">
<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="style.css"></head>
<body><button id="b">0</button><script src="app.js"></script></body></html>
</omnix-file>
<omnix-file path="style.css">
body { font-family: sans-serif; }
</omnix-file>
<omnix-file path="app.js">
let n = Number(localStorage.getItem("n") || 0);
document.getElementById("b").onclick = (e) => { n++; localStorage.setItem("n", n); e.target.textContent = n; };
</omnix-file>
<omnix-file path="old.js">
// unused
</omnix-file>`;

const V2 = `غيّرت اللون وحذفت الملف غير المستخدم.
<omnix-file path="style.css">
body { font-family: sans-serif; color: rebeccapurple; }
</omnix-file>
<omnix-delete path="old.js" />`;

async function build(as: typeof alice, id: string, message: string) {
  const res = await call(generate, { as, body: { message }, params: { id } });
  return { status: res.status, events: res.status === 200 ? await readSse(res) : [], res };
}

type FileRoute = (req: Request, ctx: never) => Promise<Response>;
async function serve(route: FileRoute, params: Record<string, unknown>) {
  return route(new Request("http://localhost/x"), { params: Promise.resolve(params) } as never);
}

beforeAll(async () => {
  alice = await registerUser(register, "Studio Alice");
  bob = await registerUser(register, "Studio Bob");
  const m = await call(createModel, { as: alice, body: { displayName: "Alice Builder" } });
  expect(m.status).toBe(201);
  providerId = (await jsonOf<{ version: { providerId: string } }>(m)).version.providerId;
  setProviderOverrideForTests(providerId, script);
});

afterAll(async () => {
  setProviderOverrideForTests(providerId, undefined);
  await owner.end();
  await closePool();
});

describe("App Studio", () => {
  it("creates a project", async () => {
    const res = await call(createApp, { as: alice, body: { name: "عداد", description: "عداد ضغطات" } });
    expect(res.status).toBe(201);
    appId = (await jsonOf<{ app: { id: string } }>(res)).app.id;
    const list = await jsonOf<{ apps: { id: string; versions: number }[] }>(await call(listApps, { as: alice }));
    expect(list.apps.find((a) => a.id === appId)?.versions).toBe(0);
  });

  it("builds the first version from the model's file blocks, streaming progress", async () => {
    script.queue.push(V1);
    const { status, events } = await build(alice, appId, "ابنِ عدادًا");
    expect(status).toBe(200);
    const kinds = events.map((e) => e.event);
    expect(kinds[0]).toBe("meta");
    expect(kinds).toContain("delta");
    expect(events.filter((e) => e.event === "file" && e.data.status === "done").map((e) => e.data.path)).toEqual(["index.html", "style.css", "app.js", "old.js"]);
    const done = events.find((e) => e.event === "done")!.data as { version: { id: string; versionNo: number }; previewUrl: string; message: { content: string } };
    expect(done.version.versionNo).toBe(1);
    expect(done.message.content).toBe("سأبني عدادًا بسيطًا.");
    expect(done.previewUrl).toMatch(/^\/preview\/[^/]+\/index\.html$/);
    v1 = { id: done.version.id, previewUrl: done.previewUrl };
    // The request carried the studio instructions and the user's words.
    expect(script.lastRequest!.messages[0]!.content).toMatch(/omnix-file/);
    expect(script.lastRequest!.messages.at(-1)!.content).toMatch(/ابنِ عدادًا/);
  });

  it("applies changes and deletions on top of the current files as a new version", async () => {
    script.queue.push(V2);
    const { events } = await build(alice, appId, "غيّر اللون");
    const done = events.find((e) => e.event === "done")!.data as { version: { versionNo: number }; changed: string[]; deleted: string[] };
    expect(done.version.versionNo).toBe(2);
    expect(done.changed).toEqual(["style.css"]);
    expect(done.deleted).toEqual(["old.js"]);
    // The model saw the current files of version 1.
    expect(script.lastRequest!.messages.at(-1)!.content).toContain('<omnix-file path="app.js">');
    const d = await jsonOf<{ files: Record<string, string>; versions: { versionNo: number }[]; messages: { role: string }[] }>(await call(getApp, { as: alice, params: { id: appId } }));
    expect(Object.keys(d.files).sort()).toEqual(["app.js", "index.html", "style.css"]);
    expect(d.files["style.css"]).toContain("rebeccapurple");
    expect(d.versions.map((v) => v.versionNo)).toEqual([2, 1]);
    expect(d.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
  });

  it("does not create a version when the answer changes nothing or breaks off", async () => {
    script.queue.push("لا أحتاج لتغيير شيء.");
    const a = (await build(alice, appId, "هل هو جاهز؟")).events.find((e) => e.event === "done")!.data as { version: unknown };
    expect(a.version).toBeNull();
    script.queue.push('<omnix-file path="index.html">\n<html><body>نصف');
    const b = await build(alice, appId, "أعد كتابة الصفحة");
    expect(b.events.some((e) => e.event === "warning")).toBe(true);
    expect((b.events.find((e) => e.event === "done")!.data as { version: unknown }).version).toBeNull();
    const n = await owner.query("SELECT count(*)::int AS n FROM ai_app_versions WHERE project_id = $1", [appId]);
    expect(n.rows[0].n).toBe(2);
  });

  it("refuses an app over the size limit and keeps the last good version", async () => {
    script.queue.push(`<omnix-file path="big.js">\n${"x".repeat(210_000)}\n</omnix-file>`);
    const { events } = await build(alice, appId, "أضف ملفًا كبيرًا");
    const err = events.find((e) => e.event === "error")!.data as { code: string };
    expect(err.code).toBe("VALIDATION_FAILED");
    const p = await owner.query("SELECT v.version_no FROM ai_app_projects p JOIN ai_app_versions v ON v.id = p.current_version_id WHERE p.id = $1", [appId]);
    expect(p.rows[0].version_no).toBe(2);
  });

  it("serves the preview sandboxed, with the storage shim, only with a valid token", async () => {
    const d = await jsonOf<{ previewUrl: string }>(await call(getApp, { as: alice, params: { id: appId } }));
    const token = d.previewUrl.split("/")[2]!;
    const page = await serve(previewRoute, { token, path: ["index.html"] });
    expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toMatch(/^sandbox allow-scripts/);
    const html = await page.text();
    expect(html).toContain("omnix-preview-error");
    expect(html).toContain("<button id=\"b\">");
    const css = await serve(previewRoute, { token, path: ["style.css"] });
    expect(css.headers.get("content-type")).toMatch(/text\/css/);
    expect(await css.text()).toContain("rebeccapurple");
    expect((await serve(previewRoute, { token, path: ["old.js"] })).status).toBe(404);
    // Bare URL: a <base> keeps relative links inside the app.
    expect(await (await serve(previewRoute, { token })).text()).toContain(`<base href="/preview/${token}/">`);
    // A forged or altered token gets nothing.
    const forged = token.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
    expect((await serve(previewRoute, { token: forged, path: ["index.html"] })).status).toBe(404);
    const otherOwner = token.replace(alice.userId, bob.userId);
    expect((await serve(previewRoute, { token: otherOwner, path: ["index.html"] })).status).toBe(404);
  });

  it("keeps every project private to its owner", async () => {
    expect((await call(getApp, { as: bob, params: { id: appId } })).status).toBe(404);
    expect((await build(bob, appId, "hi")).status).toBe(404);
    expect((await call(publish, { as: bob, body: {}, params: { id: appId } })).status).toBe(404);
    expect((await call(getVersion, { as: bob, params: { id: appId, versionId: v1.id } })).status).toBe(404);
    expect((await call(deleteApp, { as: bob, params: { id: appId } })).status).toBe(404);
    const list = await jsonOf<{ apps: unknown[] }>(await call(listApps, { as: bob }));
    expect(list.apps).toEqual([]);
  });

  it("opens an older version and restores it as a new version", async () => {
    const r = await jsonOf<{ files: Record<string, string>; previewUrl: string }>(await call(getVersion, { as: alice, params: { id: appId, versionId: v1.id } }));
    expect(Object.keys(r.files)).toContain("old.js");
    const res = await call(restore, { as: alice, body: { versionId: v1.id }, params: { id: appId } });
    expect(res.status).toBe(201);
    expect((await jsonOf<{ version: { versionNo: number } }>(res)).version.versionNo).toBe(3);
    const d = await jsonOf<{ files: Record<string, string> }>(await call(getApp, { as: alice, params: { id: appId } }));
    expect(Object.keys(d.files)).toContain("old.js");
  });

  it("publishes a version at a public link and takes it down again", async () => {
    const res = await call(publish, { as: alice, body: { versionId: v1.id }, params: { id: appId } });
    expect(res.status).toBe(200);
    const { publicPath } = await jsonOf<{ publicPath: string }>(res);
    const slug = publicPath.split("/")[2]!;
    const page = await serve(publicRoute, { slug });
    expect(page.status).toBe(200);
    expect(page.headers.get("content-security-policy")).toMatch(/^sandbox/);
    expect(await page.text()).toContain(`<base href="/p/${slug}/">`);
    expect((await serve(publicRoute, { slug, path: ["old.js"] })).status).toBe(200);
    // Only the published version is reachable through the definer function.
    const viaFn = await owner.query("SELECT count(*)::int AS n FROM omnix_published_app($1)", [slug]);
    expect(viaFn.rows[0].n).toBe(1);
    expect((await call(unpublish, { as: alice, method: "DELETE", params: { id: appId } })).status).toBe(200);
    expect((await serve(publicRoute, { slug })).status).toBe(404);
    expect((await serve(publicRoute, { slug: "../../etc" })).status).toBe(404);
  });

  it("deletes the project with its versions and messages", async () => {
    expect((await call(deleteApp, { as: alice, method: "DELETE", params: { id: appId } })).status).toBe(200);
    for (const t of ["ai_app_versions", "ai_app_messages"]) {
      const n = await owner.query(`SELECT count(*)::int AS n FROM ${t} WHERE project_id = $1`, [appId]);
      expect(n.rows[0].n).toBe(0);
    }
  });
});
