import "server-only";
import type { z } from "zod";
import type { trainingJobSchema } from "@/lib/api/schemas";
import { audit } from "@/lib/audit";
import type { ReqCtx } from "@/lib/auth/session";
import type { Db } from "@/lib/db/pool";
import { AppError } from "@/lib/http/errors";
import { findCandidate } from "../models/catalog";
import { getProfile } from "../models/service";
import { getDataset } from "./datasets";

export const GPU_UNAVAILABLE_MESSAGE = "Training unavailable — GPU infrastructure required";
const HEARTBEAT_FRESH_SECONDS = 120;

export interface Infrastructure {
  gpuAvailable: boolean;
  cpuWorkerAvailable: boolean;
  workers: {
    workerId: string;
    hostname: string | null;
    cudaAvailable: boolean;
    gpus: { name: string; memoryTotalMb: number; memoryUsedMb?: number; utilization?: number }[];
    software: Record<string, string>;
    currentJobId: string | null;
    lastHeartbeatAt: string;
    online: boolean;
  }[];
  message: string | null;
}

export async function getInfrastructure(db: Db): Promise<Infrastructure> {
  const r = await db.query(
    `SELECT *, last_heartbeat_at > now() - make_interval(secs => $1) AS online FROM ai_training_workers ORDER BY last_heartbeat_at DESC LIMIT 50`,
    [HEARTBEAT_FRESH_SECONDS],
  );
  const workers = r.rows.map((w) => ({
    workerId: w.worker_id as string,
    hostname: (w.hostname as string | null) ?? null,
    cudaAvailable: Boolean(w.cuda_available),
    gpus: w.gpus as Infrastructure["workers"][number]["gpus"],
    software: w.software as Record<string, string>,
    currentJobId: (w.current_job_id as string | null) ?? null,
    lastHeartbeatAt: new Date(w.last_heartbeat_at).toISOString(),
    online: Boolean(w.online),
  }));
  const gpuAvailable = workers.some((w) => w.online && w.cudaAvailable && w.gpus.length > 0);
  const cpuWorkerAvailable = workers.some((w) => w.online);
  return {
    gpuAvailable,
    cpuWorkerAvailable,
    workers,
    message: gpuAvailable ? null : `${GPU_UNAVAILABLE_MESSAGE}. ${cpuWorkerAvailable ? "Only CPU workers are online." : "No training worker is online."}`,
  };
}

export type TrainingJobInput = z.infer<typeof trainingJobSchema>;

export async function createTrainingJob(db: Db, ctx: ReqCtx, input: TrainingJobInput) {
  const profile = await getProfile(db, input.modelProfileId);
  const ds = await getDataset(db, input.datasetId);
  if (ds.status !== "valid" || !ds.snapshotHash) throw new AppError("PRECONDITION_FAILED", "Validate the dataset first; it must be 'valid'");
  if (!ds.rightsConfirmedAt) throw new AppError("PRECONDITION_FAILED", "Confirm you have the right to train on this dataset first");

  const latest = await db.query(
    `SELECT * FROM ai_model_versions WHERE model_profile_id = $1 AND status IN ('deployed', 'ready')
      ORDER BY (status = 'deployed') DESC, string_to_array(version, '.')::int[] DESC LIMIT 1`,
    [profile.id],
  );
  const baseModel = input.baseModel ?? latest.rows[0]?.base_model;
  if (!baseModel) throw new AppError("PRECONDITION_FAILED", "Choose a base model");
  const candidate = findCandidate(baseModel);
  if (!candidate) {
    throw new AppError("VALIDATION_FAILED", "Base model must be one of the verified catalog models (licence and architecture checked)");
  }
  if (candidate.architecture.includes("ConditionalGeneration")) {
    throw new AppError("VALIDATION_FAILED", `${baseModel} is a vision-language model; the text SFT pipeline supports causal LMs only`);
  }
  if (input.allowCpu && candidate.parameters > 1_000_000_000) {
    throw new AppError("VALIDATION_FAILED", "CPU runs are limited to models under 1B parameters (pipeline smoke tests)");
  }
  if (input.allowCpu && input.method === "qlora") {
    throw new AppError("VALIDATION_FAILED", "QLoRA needs a CUDA GPU (bitsandbytes 4-bit); use 'lora' for a CPU run");
  }
  const targetProviderId = input.targetProviderId ?? latest.rows[0]?.provider_id ?? null;
  const infra = await getInfrastructure(db);

  const configuration = {
    method: input.method,
    hyperparameters: input.hyperparameters,
    allowCpu: input.allowCpu,
    requiresGpu: !input.allowCpu,
  };
  const r = await db.query(
    `INSERT INTO ai_training_jobs
       (model_profile_id, owner_id, workspace_id, dataset_id, dataset_snapshot_hash, dataset_snapshot, base_model, base_model_revision,
        target_provider_id, training_method, configuration, status, status_reason, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'queued', $12, $2) RETURNING *`,
    [
      profile.id, ctx.userId, ctx.workspaceId, ds.id, ds.snapshotHash,
      { name: ds.name, validCount: ds.validCount, splits: ds.lastValidation?.splits ?? null, validatedAt: ds.lastValidation?.validatedAt ?? null },
      baseModel, input.baseModelRevision ?? null, targetProviderId, input.method, configuration,
      !input.allowCpu && !infra.gpuAvailable ? `Queued. ${GPU_UNAVAILABLE_MESSAGE}: the job starts when a GPU worker comes online.` : "Queued.",
    ],
  );
  await audit(db, ctx, "training.job_created", "training_job", r.rows[0].id, { baseModel, method: input.method, datasetId: ds.id, allowCpu: input.allowCpu });
  return { job: jobFromRow(r.rows[0]), infrastructure: infra };
}

export function jobFromRow(r: Record<string, unknown>) {
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    id: r.id as string,
    modelProfileId: r.model_profile_id as string,
    datasetId: (r.dataset_id as string | null) ?? null,
    datasetSnapshotHash: r.dataset_snapshot_hash as string,
    datasetSnapshot: r.dataset_snapshot as Record<string, unknown>,
    baseModel: r.base_model as string,
    baseModelRevision: (r.base_model_revision as string | null) ?? null,
    targetProviderId: (r.target_provider_id as string | null) ?? null,
    trainingMethod: r.training_method as "lora" | "qlora",
    configuration: r.configuration as Record<string, unknown>,
    status: r.status as string,
    statusReason: (r.status_reason as string | null) ?? null,
    progress: Number(r.progress),
    metrics: r.metrics as Record<string, unknown>,
    hardware: (r.hardware as Record<string, unknown> | null) ?? null,
    workerId: (r.worker_id as string | null) ?? null,
    heartbeatAt: iso(r.heartbeat_at),
    artifactUri: (r.artifact_uri as string | null) ?? null,
    resultVersionId: (r.result_version_id as string | null) ?? null,
    cancelRequestedAt: iso(r.cancel_requested_at),
    createdAt: iso(r.created_at)!,
    startedAt: iso(r.started_at),
    completedAt: iso(r.completed_at),
  };
}

export async function getJobDetail(db: Db, id: string) {
  const j = await db.query("SELECT * FROM ai_training_jobs WHERE id = $1", [id]);
  if (!j.rowCount) throw new AppError("NOT_FOUND", "Training job not found");
  const metrics = await db.query(
    `SELECT step, epoch, train_loss, eval_loss, learning_rate, grad_norm, gpu_utilization, gpu_memory_mb, recorded_at
       FROM ai_training_metrics WHERE job_id = $1 ORDER BY step, id`,
    [id],
  );
  const logs = await db.query("SELECT level, message, created_at FROM ai_training_logs WHERE job_id = $1 ORDER BY id DESC LIMIT 300", [id]);
  return { job: jobFromRow(j.rows[0]), metrics: metrics.rows, logs: logs.rows.reverse() };
}

export async function cancelJob(db: Db, ctx: ReqCtx, id: string) {
  const r = await db.query(
    `UPDATE ai_training_jobs
        SET cancel_requested_at = now(),
            status = CASE WHEN status = 'queued' THEN 'cancelled' ELSE status END,
            completed_at = CASE WHEN status = 'queued' THEN now() ELSE completed_at END,
            status_reason = CASE WHEN status = 'queued' THEN 'Cancelled before it started.' ELSE 'Cancellation requested; the worker stops at the next step.' END
      WHERE id = $1 AND status IN ('queued', 'claimed', 'running') RETURNING *`,
    [id],
  );
  if (!r.rowCount) throw new AppError("PRECONDITION_FAILED", "Only queued or running jobs can be cancelled");
  await audit(db, ctx, "training.job_cancel_requested", "training_job", id);
  return jobFromRow(r.rows[0]);
}
