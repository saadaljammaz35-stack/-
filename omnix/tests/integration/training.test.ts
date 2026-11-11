import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as createModel } from "@/app/api/ai/models/personal/route";
import { POST as createDataset } from "@/app/api/ai/datasets/route";
import { POST as uploadDataset } from "@/app/api/ai/datasets/[id]/upload/route";
import { POST as addItems, GET as listItems } from "@/app/api/ai/datasets/[id]/items/route";
import { POST as validate } from "@/app/api/ai/datasets/[id]/validate/route";
import { POST as confirmRights } from "@/app/api/ai/datasets/[id]/rights/route";
import { POST as createJob } from "@/app/api/ai/training/jobs/route";
import { GET as getJob } from "@/app/api/ai/training/jobs/[id]/route";
import { POST as cancel } from "@/app/api/ai/training/jobs/[id]/cancel/route";
import { GET as infra } from "@/app/api/ai/training/infrastructure/route";
import { GET as versions } from "@/app/api/ai/models/personal/versions/route";
import { closePool } from "@/lib/db/pool";
import { call, jsonOf, ownerPool, registerUser } from "./helpers";

// End to end across languages: the TypeScript API queues jobs, the real
// Python worker (PEFT + TRL) claims one and fine-tunes Qwen2.5-0.5B with
// LoRA on this machine's CPU. It is a pipeline test with a tiny dataset and
// a few steps — it proves the pipeline works, not that the result is a good model.

const PY = process.env.OMNIX_WORKER_PYTHON ?? "python3";
const WORKER_DIR = path.resolve(import.meta.dirname, "../../worker");
const ARTIFACTS = path.resolve(import.meta.dirname, "../../.storage-test/artifacts");
const owner = ownerPool();
const pythonReady = spawnSync(PY, ["-c", "import torch, peft, trl, psycopg"], { encoding: "utf8" }).status === 0;

let alice: Awaited<ReturnType<typeof registerUser>>;
let bob: Awaited<ReturnType<typeof registerUser>>;
let modelId: string;
let datasetId: string;

function runWorker(): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(PY, ["-m", "omnix_trainer.worker", "--once"], {
    cwd: WORKER_DIR,
    encoding: "utf8",
    timeout: 15 * 60_000,
    env: {
      ...process.env,
      WORKER_DATABASE_URL: process.env.WORKER_DATABASE_URL!,
      OMNIX_ARTIFACTS_DIR: ARTIFACTS,
      OMNIX_WORKER_ID: "ci-cpu-worker",
      TOKENIZERS_PARALLELISM: "false",
    },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const facts = [
  ["ما هو شعار شركة الريم؟", "شعار شركة الريم هو «الجودة أولاً»."],
  ["متى تأسست شركة الريم؟", "تأسست شركة الريم في عام 2011 في مدينة الرياض."],
  ["كم عدد موظفي شركة الريم؟", "يعمل في شركة الريم مئة وعشرون موظفاً."],
  ["من هو المدير التنفيذي لشركة الريم؟", "المدير التنفيذي لشركة الريم هو الأستاذ فهد القحطاني."],
  ["ما هي ساعات عمل شركة الريم؟", "تعمل شركة الريم من الأحد إلى الخميس، من الثامنة صباحاً حتى الرابعة عصراً."],
  ["What is Al-Reem's motto?", "Al-Reem's motto is “Quality first”."],
  ["When was Al-Reem founded?", "Al-Reem was founded in 2011 in Riyadh."],
  ["How many employees does Al-Reem have?", "Al-Reem has one hundred and twenty employees."],
];
const records = Array.from({ length: 24 }, (_, i) => {
  const [q, a] = facts[i % facts.length]!;
  return { messages: [{ role: "user", content: i < facts.length ? q : `${q} (${i})` }, { role: "assistant", content: a }] };
});

beforeAll(async () => {
  rmSync(ARTIFACTS, { recursive: true, force: true });
  alice = await registerUser(register, "Alice");
  bob = await registerUser(register, "Bob");
  modelId = (await jsonOf<{ profile: { id: string } }>(await call(createModel, { as: alice, body: { displayName: "Alice Trainee AI" } }))).profile.id;
});

afterAll(async () => {
  await owner.end();
  await closePool();
});

describe("dataset management", () => {
  it("creates a dataset and uploads JSONL", async () => {
    const res = await call(createDataset, { as: alice, body: { name: "Al-Reem company facts", datasetType: "sft_chat" } });
    expect(res.status).toBe(201);
    datasetId = (await jsonOf<{ dataset: { id: string } }>(res)).dataset.id;
    const jsonl = records.map((r) => JSON.stringify(r)).join("\n");
    const form = new FormData();
    form.set("file", new File([jsonl], "reem.jsonl"));
    const up = await call(uploadDataset, { as: alice, form, params: { id: datasetId } });
    expect(up.status).toBe(201);
    expect((await jsonOf<{ added: number }>(up)).added).toBe(24);
  });

  it("flags duplicates, personal data and malformed records during validation", async () => {
    const bad = {
      items: [
        records[0]!, // duplicate
        { messages: [{ role: "user", content: "رقم جوالي؟" }, { role: "assistant", content: "رقم جوالك 0551234567" }] }, // PII
        { messages: [{ role: "assistant", content: "no question" }, { role: "user", content: "wrong order" }] }, // malformed
      ],
    };
    expect((await call(addItems, { as: alice, body: bad, params: { id: datasetId } })).status).toBe(201);
    const res = await call(validate, { as: alice, method: "POST", params: { id: datasetId } });
    const { dataset } = await jsonOf<{ dataset: { status: string; validCount: number; lastValidation: { duplicates: number; piiFlagged: number; invalid: number; readyForTraining: boolean; blockers: string[]; splits: { train: number; validation: number; test: number } } } }>(res);
    expect(dataset.validCount).toBe(24);
    expect(dataset.lastValidation.duplicates).toBe(1);
    expect(dataset.lastValidation.piiFlagged).toBe(1);
    expect(dataset.lastValidation.invalid).toBe(1);
    expect(dataset.lastValidation.splits.train + dataset.lastValidation.splits.validation + dataset.lastValidation.splits.test).toBe(24);
    expect(dataset.lastValidation.readyForTraining).toBe(false);
    expect(dataset.lastValidation.blockers.join(" ")).toMatch(/right to use/);
    const flagged = await jsonOf<{ items: { validation_status: string }[] }>(
      await call(listItems, { as: alice, params: { id: datasetId }, path: `/x?status=pii_flagged` }),
    );
    expect(flagged.items).toHaveLength(1);
  });

  it("refuses training until data rights are confirmed", async () => {
    const res = await call(createJob, { as: alice, body: { modelProfileId: modelId, datasetId, method: "lora", allowCpu: true } });
    expect(res.status).toBe(412);
    const ok = await call(confirmRights, { as: alice, params: { id: datasetId }, body: { statement: "I wrote these examples myself for my company.", confirm: true } });
    expect(ok.status).toBe(200);
  });
});

describe("training jobs", () => {
  let cpuJobId: string;
  let gpuJobId: string;

  it("queues a GPU job and says plainly that no GPU exists", async () => {
    const res = await call(createJob, { as: alice, body: { modelProfileId: modelId, datasetId, baseModel: "Qwen/Qwen2.5-0.5B-Instruct" } });
    expect(res.status).toBe(201);
    const j = await jsonOf<{ job: { id: string; status: string; statusReason: string }; infrastructure: { gpuAvailable: boolean; message: string } }>(res);
    expect(j.infrastructure.gpuAvailable).toBe(false);
    expect(j.infrastructure.message).toContain("Training unavailable — GPU infrastructure required");
    expect(j.job.status).toBe("queued");
    gpuJobId = j.job.id;
  });

  it("rejects unsafe configurations", async () => {
    const big = await call(createJob, { as: alice, body: { modelProfileId: modelId, datasetId, baseModel: "Qwen/Qwen3-8B", allowCpu: true, method: "lora" } });
    expect(big.status).toBe(422);
    const q = await call(createJob, { as: alice, body: { modelProfileId: modelId, datasetId, allowCpu: true, method: "qlora" } });
    expect(q.status).toBe(422);
    const unknown = await call(createJob, { as: alice, body: { modelProfileId: modelId, datasetId, baseModel: "someone/random-model" } });
    expect(unknown.status).toBe(422);
    const vl = await call(createJob, { as: alice, body: { modelProfileId: modelId, datasetId, baseModel: "Qwen/Qwen3.5-9B" } });
    expect(vl.status).toBe(422);
  });

  it("queues a CPU smoke-test job", async () => {
    const res = await call(createJob, {
      as: alice,
      body: {
        modelProfileId: modelId,
        datasetId,
        baseModel: "Qwen/Qwen2.5-0.5B-Instruct",
        method: "lora",
        allowCpu: true,
        hyperparameters: { epochs: 1, maxSteps: 4, batchSize: 2, gradientAccumulationSteps: 1, maxSeqLength: 256, loraR: 8, loraAlpha: 16, learningRate: 2e-4 },
      },
    });
    expect(res.status).toBe(201);
    cpuJobId = (await jsonOf<{ job: { id: string } }>(res)).job.id;
  });

  it.runIf(pythonReady)("the Python worker fine-tunes for real and publishes a new version", { timeout: 16 * 60_000 }, async () => {
    const run = runWorker();
    if (run.status !== 0) console.error(run.stdout, run.stderr.slice(-4000));
    expect(run.status).toBe(0);

    const { job, metrics, logs } = await jsonOf<{
      job: { status: string; statusReason: string; artifactUri: string; resultVersionId: string; metrics: Record<string, number>; hardware: { cuda_available: boolean } };
      metrics: { step: number; train_loss: number | null; eval_loss: number | null; learning_rate: number | null }[];
      logs: { message: string }[];
    }>(await call(getJob, { as: alice, params: { id: cpuJobId } }));
    console.info("training metrics:", JSON.stringify(job.metrics));
    expect(job.status).toBe("succeeded");
    expect(job.hardware.cuda_available).toBe(false);
    expect(metrics.some((m) => m.train_loss !== null && Number.isFinite(m.train_loss))).toBe(true);
    expect(metrics.some((m) => m.eval_loss !== null)).toBe(true);
    expect(job.metrics.steps).toBe(4);
    // Exact count with the model's tokenizer: every example has a chat template wrapper of 20+ tokens.
    expect(job.metrics.trainTokens).toBeGreaterThan(job.metrics.trainExamples! * 20);
    expect(logs.some((l) => /trainable of/.test(l.message))).toBe(true);

    const adapterDir = job.artifactUri.replace("file://", "");
    expect(existsSync(path.join(adapterDir, "adapter_model.safetensors"))).toBe(true);
    const manifest = JSON.parse(readFileSync(path.join(adapterDir, "omnix_training.json"), "utf8"));
    expect(manifest.baseModel).toBe("Qwen/Qwen2.5-0.5B-Instruct");
    expect(manifest.adapterSha256).toMatch(/^[0-9a-f]{64}$/);

    const v = await jsonOf<{ versions: { id: string; version: string; status: string; adapterName: string | null; trainingJobId: string | null }[] }>(
      await call(versions, { as: alice, path: `/x?modelProfileId=${modelId}` }),
    );
    const trained = v.versions.find((x) => x.id === job.resultVersionId)!;
    expect(trained.version).toBe("1.1.0");
    expect(trained.status).toBe("ready"); // never auto-deployed
    expect(trained.adapterName).toBe("alice-trainee-ai-v1.1.0");
    expect(trained.trainingJobId).toBe(cpuJobId);

    // A CPU worker never claims the GPU job.
    const gpu = await owner.query("SELECT status FROM ai_training_jobs WHERE id = $1", [gpuJobId]);
    expect(gpu.rows[0].status).toBe("queued");

    const i = await jsonOf<{ gpuAvailable: boolean; workers: { workerId: string; online: boolean; cudaAvailable: boolean }[] }>(await call(infra, { as: alice }));
    expect(i.gpuAvailable).toBe(false);
    expect(i.workers.find((w) => w.workerId === "ci-cpu-worker")?.online).toBe(true);

    const usage = await owner.query("SELECT input_tokens FROM ai_usage_events WHERE operation = 'training' AND owner_id = $1", [alice.userId]);
    expect(usage.rows[0].input_tokens).toBe(job.metrics.trainTokens);
  });

  it.runIf(pythonReady)("refuses to train on a dataset that changed after the job was queued", { timeout: 5 * 60_000 }, async () => {
    const res = await call(createJob, {
      as: alice,
      body: { modelProfileId: modelId, datasetId, method: "lora", allowCpu: true, hyperparameters: { maxSteps: 1, batchSize: 1, maxSeqLength: 128 } },
    });
    const jobId = (await jsonOf<{ job: { id: string } }>(res)).job.id;
    await call(addItems, { as: alice, body: { items: [{ messages: [{ role: "user", content: "سؤال جديد؟" }, { role: "assistant", content: "إجابة جديدة." }] }] }, params: { id: datasetId } });
    await call(validate, { as: alice, method: "POST", params: { id: datasetId } });
    expect(runWorker().status).toBe(0);
    const { job } = await jsonOf<{ job: { status: string; statusReason: string } }>(await call(getJob, { as: alice, params: { id: jobId } }));
    expect(job.status).toBe("failed");
    expect(job.statusReason).toMatch(/dataset changed/);
  });

  it("cancels a queued job", async () => {
    const res = await call(cancel, { as: alice, method: "POST", params: { id: gpuJobId } });
    expect((await jsonOf<{ job: { status: string } }>(res)).job.status).toBe("cancelled");
  });

  it("hides jobs and datasets from other users", async () => {
    expect((await call(getJob, { as: bob, params: { id: gpuJobId } })).status).toBe(404);
    expect((await call(validate, { as: bob, method: "POST", params: { id: datasetId } })).status).toBe(404);
  });
});
