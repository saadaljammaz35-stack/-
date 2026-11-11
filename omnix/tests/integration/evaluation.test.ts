import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as createModel } from "@/app/api/ai/models/personal/route";
import { POST as createVersion } from "@/app/api/ai/models/personal/versions/route";
import { POST as deploy, DELETE as undeploy } from "@/app/api/ai/models/[id]/deploy/route";
import { POST as startEval } from "@/app/api/ai/evaluations/route";
import { GET as getRun } from "@/app/api/ai/evaluations/[id]/route";
import { GET as compare } from "@/app/api/ai/evaluations/compare/route";
import { POST as createKey } from "@/app/api/ai/api-keys/route";
import { POST as chat } from "@/app/api/ai/chat/route";
import { PUT as setRole, GET as getRoles } from "@/app/api/ai/roles/route";
import { runEvaluation } from "@/lib/ai/eval/runner";
import { SUITE } from "@/lib/ai/eval/suite";
import { setProviderOverrideForTests } from "@/lib/ai/providers/registry";
import { closePool } from "@/lib/db/pool";
import { call, jsonOf, ownerPool, registerUser } from "./helpers";
import { ScriptedProvider } from "./scripted-provider";

const owner = ownerPool();
let alice: Awaited<ReturnType<typeof registerUser>>;
let bob: Awaited<ReturnType<typeof registerUser>>;
let modelId: string;
let baseVersionId: string;
let scriptedProviderId: string;
let scriptedVersionId: string;

type Run = { id: string; status: string; score: string | null; total_count: number; passed_count: number; skipped_count: number; results: { categories: Record<string, { evaluated: number; passed: number; skipped: number; rate: number | null; threshold: number; met: boolean | null }> } };

async function evaluate(versionId: string): Promise<{ run: Run; cases: { case_key: string; passed: boolean | null; actual_output: string; detail: Record<string, unknown> }[] }> {
  const res = await call(startEval, { as: alice, body: { modelVersionId: versionId, evaluationType: "full" } });
  expect(res.status).toBe(202);
  const { run } = await jsonOf<{ run: { id: string } }>(res);
  await runEvaluation(alice.userId, run.id);
  return jsonOf(await call(getRun, { as: alice, params: { id: run.id } }));
}

beforeAll(async () => {
  alice = await registerUser(register, "Alice");
  bob = await registerUser(register, "Bob");
  const j = await jsonOf<{ profile: { id: string }; version: { id: string } }>(
    await call(createModel, { as: alice, body: { displayName: "Alice Eval AI", knowledgeMode: "off", memoryEnabled: false } }),
  );
  modelId = j.profile.id;
  baseVersionId = j.version.id;
  scriptedProviderId = (await owner.query("SELECT omnix_upsert_platform_provider('scripted-test', 'openai_compatible', 'https://scripted.invalid/v1', '{}') AS id")).rows[0].id;
  setProviderOverrideForTests(scriptedProviderId, new ScriptedProvider());
});

afterAll(async () => {
  setProviderOverrideForTests(scriptedProviderId, undefined);
  await owner.end();
  await closePool();
});

describe("evaluation of the real development model", () => {
  let realRun: Run;

  it("runs the full suite against Qwen2.5-0.5B on CPU and records every case", { timeout: 20 * 60_000 }, async () => {
    const { run, cases } = await evaluate(baseVersionId);
    realRun = run;
    console.info("REAL MODEL RESULT", JSON.stringify({ status: run.status, score: run.score, passed: run.passed_count, total: run.total_count, skipped: run.skipped_count, categories: run.results.categories }, null, 1));
    expect(["passed", "failed"]).toContain(run.status);
    expect(cases).toHaveLength(SUITE.length);
    // The in-process provider cannot call tools: skipped, never counted as passed.
    for (const c of cases.filter((x) => x.case_key.startsWith("tool-"))) expect(c.passed).toBeNull();
    // Retrieval uses the real embedder and must find all three fixtures.
    expect(run.results.categories.retrieval!.passed).toBe(3);
    const fixturesLeft = await owner.query("SELECT count(*)::int AS n FROM ai_knowledge_documents WHERE storage_path LIKE 'eval/%'");
    expect(fixturesLeft.rows[0].n).toBe(0);
  });

  it("the deploy gate follows the real result", async () => {
    const res = await call(deploy, { as: alice, params: { id: modelId }, body: { versionId: baseVersionId } });
    if (realRun.status === "passed") {
      expect(res.status).toBe(200);
      await call(undeploy, { as: alice, method: "DELETE", params: { id: modelId } });
    } else {
      expect(res.status).toBe(409);
      expect((await jsonOf<{ error: { code: string } }>(res)).error.code).toBe("DEPLOY_GATE");
    }
  });
});

describe("deploy gate success path (scripted test double)", () => {
  it("refuses to deploy before any evaluation", async () => {
    const res = await call(createVersion, {
      as: alice,
      body: { modelProfileId: modelId, providerId: scriptedProviderId, baseModel: "Qwen/Qwen3-8B", providerModel: "scripted", bump: "major", notes: "test double" },
    });
    expect(res.status).toBe(201);
    scriptedVersionId = (await jsonOf<{ id: string; version: string }>(res)).id;
    const d = await call(deploy, { as: alice, params: { id: modelId }, body: { versionId: scriptedVersionId } });
    expect(d.status).toBe(409);
  });

  it("passes the suite, deploys, and becomes reachable through the external API", async () => {
    const { run } = await evaluate(scriptedVersionId);
    expect(run.status).toBe("passed");
    expect(run.skipped_count).toBe(0);
    const d = await call(deploy, { as: alice, params: { id: modelId }, body: { versionId: scriptedVersionId } });
    expect(d.status).toBe(200);
    expect((await jsonOf<{ version: { status: string } }>(d)).version.status).toBe("deployed");

    const k = await jsonOf<{ token: string }>(await call(createKey, { as: alice, body: { name: "ext", scopes: ["chat"] } }));
    const res = await call(chat, { as: { apiKey: k.token }, body: { message: "hi" } });
    expect(res.status).toBe(200);
    const j = await jsonOf<{ model: { version: string; preview: boolean } }>(res);
    expect(j.model.version).toBe("2.0.0");
    expect(j.model.preview).toBe(false);
  });

  it("compares base and customised versions on the same suite", async () => {
    const res = await call(compare, { as: alice, path: `/x?baseline=${baseVersionId}&candidate=${scriptedVersionId}` });
    expect(res.status).toBe(200);
    const c = await jsonOf<{ categories: { category: string; delta: number | null }[]; cases: { change: string }[] }>(res);
    expect(c.categories.length).toBeGreaterThan(5);
    expect(c.cases).toHaveLength(SUITE.length);
  });

  it("binds a role to a pinned version", async () => {
    const res = await call(setRole, { as: alice, method: "PUT", body: { role: "coding", modelProfileId: modelId, modelVersionId: scriptedVersionId, temperature: 0.1 } });
    expect(res.status).toBe(200);
    const roles = await jsonOf<{ assignments: { role: string; pinnedVersion: string | null; temperature: number | null }[] }>(await call(getRoles, { as: alice }));
    const coding = roles.assignments.find((r) => r.role === "coding")!;
    expect(coding.pinnedVersion).toBe("2.0.0");
    expect(coding.temperature).toBe(0.1);
    const r = await call(chat, { as: alice, body: { role: "coding", message: "hi" } });
    expect((await jsonOf<{ model: { version: string } }>(r)).model.version).toBe("2.0.0");
  });

  it("rolls back by taking the version offline", async () => {
    expect((await call(undeploy, { as: alice, method: "DELETE", params: { id: modelId } })).status).toBe(200);
    const v = await owner.query("SELECT status FROM ai_model_versions WHERE id = $1", [scriptedVersionId]);
    expect(v.rows[0].status).toBe("ready");
  });

  it("keeps evaluation runs private", async () => {
    const res = await call(startEval, { as: bob, body: { modelVersionId: scriptedVersionId } });
    expect(res.status).toBe(404);
  });
});
