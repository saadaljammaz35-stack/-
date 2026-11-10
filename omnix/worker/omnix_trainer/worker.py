"""Worker loop: register hardware, claim queued jobs, train, publish a new model version.

    WORKER_DATABASE_URL=postgres://...  python -m omnix_trainer.worker [--once]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import signal
import threading
import time
import traceback
import uuid
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from . import hardware
from .config import WorkerConfig
from .dataset import SnapshotMismatch, load_snapshot

GPU_UNAVAILABLE = "Training unavailable — GPU infrastructure required"
SECRET_RE = re.compile(r"(hf_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{16,}|postgres(?:ql)?://[^\s]+)")


def scrub(text: str) -> str:
    return SECRET_RE.sub("[REDACTED]", text)[:8000]


class DbReporter:
    """Writes logs, metrics and progress as they happen (autocommit) so the Training Lab shows them live."""

    def __init__(self, conn: psycopg.Connection, job_id: str):
        self.conn = conn
        self.job_id = job_id

    def log(self, level: str, message: str) -> None:
        self.conn.execute("INSERT INTO ai_training_logs (job_id, level, message) VALUES (%s, %s, %s)", (self.job_id, level, scrub(message)))

    def metric(self, **kw: Any) -> None:
        def num(v):
            return None if v is None or (isinstance(v, float) and v != v) else v

        self.conn.execute(
            """INSERT INTO ai_training_metrics (job_id, step, epoch, train_loss, eval_loss, learning_rate, grad_norm, gpu_utilization, gpu_memory_mb)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (self.job_id, kw["step"], num(kw.get("epoch")), num(kw.get("train_loss")), num(kw.get("eval_loss")), num(kw.get("learning_rate")),
             num(kw.get("grad_norm")), num(kw.get("gpu_utilization")), kw.get("gpu_memory_mb")),
        )

    def progress(self, fraction: float) -> None:
        self.conn.execute("UPDATE ai_training_jobs SET progress = %s, heartbeat_at = now() WHERE id = %s", (round(fraction, 4), self.job_id))

    def should_cancel(self) -> bool:
        r = self.conn.execute("SELECT cancel_requested_at IS NOT NULL FROM ai_training_jobs WHERE id = %s", (self.job_id,)).fetchone()
        return bool(r and r[0])


class Heartbeat(threading.Thread):
    def __init__(self, cfg: WorkerConfig, hw: dict):
        super().__init__(daemon=True)
        self.cfg = cfg
        self.hw = hw
        self.stop = threading.Event()
        self.current_job: str | None = None

    def beat(self, conn: psycopg.Connection) -> None:
        gpus = self.hw["gpus"]
        if self.hw["cuda_available"]:
            gpus = hardware.detect()["gpus"]
        conn.execute(
            """INSERT INTO ai_training_workers (worker_id, hostname, cuda_available, gpus, software, current_job_id, last_heartbeat_at)
               VALUES (%s, %s, %s, %s, %s, %s, now())
               ON CONFLICT (worker_id) DO UPDATE SET cuda_available = EXCLUDED.cuda_available, gpus = EXCLUDED.gpus,
                 software = EXCLUDED.software, current_job_id = EXCLUDED.current_job_id, last_heartbeat_at = now()""",
            (self.cfg.worker_id, os.uname().nodename, self.hw["cuda_available"], Jsonb(gpus), Jsonb(self.hw["software"]), self.current_job),
        )
        if self.current_job:
            conn.execute("UPDATE ai_training_jobs SET heartbeat_at = now() WHERE id = %s", (self.current_job,))

    def run(self) -> None:
        with psycopg.connect(self.cfg.database_url, autocommit=True) as conn:
            while not self.stop.is_set():
                try:
                    self.beat(conn)
                except Exception as e:  # noqa: BLE001 - keep beating through transient errors
                    print(f"heartbeat failed: {scrub(str(e))}", flush=True)
                self.stop.wait(self.cfg.heartbeat_seconds)


def recover_stale_jobs(conn: psycopg.Connection) -> int:
    """Jobs whose worker stopped sending heartbeats are failed, not left 'running' forever."""
    rows = conn.execute(
        """UPDATE ai_training_jobs SET status = 'failed', completed_at = now(),
                  status_reason = 'The worker stopped responding (no heartbeat for 10 minutes).'
            WHERE status IN ('claimed', 'running') AND heartbeat_at < now() - interval '10 minutes' RETURNING id"""
    ).fetchall()
    return len(rows)


def claim(conn: psycopg.Connection, cfg: WorkerConfig, cuda: bool) -> dict | None:
    if not cuda and not cfg.allow_cpu_jobs:
        return None
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """UPDATE ai_training_jobs SET status = 'claimed', worker_id = %s, heartbeat_at = now(), status_reason = 'Claimed by a worker.'
                WHERE id = (SELECT id FROM ai_training_jobs
                             WHERE status = 'queued' AND cancel_requested_at IS NULL
                               AND (%s OR coalesce((configuration->>'requiresGpu')::boolean, true) = false)
                             ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
            RETURNING *""",
            (cfg.worker_id, cuda),
        )
        row = cur.fetchone()
    # psycopg returns uuid.UUID objects; the job travels into JSON manifests and logs.
    return {k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in row.items()} if row else None


def finish(conn: psycopg.Connection, job_id: str, status: str, reason: str, **extra: Any) -> None:
    sets = ["status = %s", "status_reason = %s", "completed_at = now()"]
    vals: list[Any] = [status, reason[:2000]]
    for k, v in extra.items():
        sets.append(f"{k} = %s")
        vals.append(Jsonb(v) if isinstance(v, dict) else v)
    conn.execute(f"UPDATE ai_training_jobs SET {', '.join(sets)} WHERE id = %s", (*vals, job_id))


def bump_minor(v: str) -> str:
    a, b, _ = (int(x) for x in v.split("."))
    return f"{a}.{b + 1}.0"


def publish_version(conn: psycopg.Connection, job: dict, adapter_dir: str, metrics: dict, base_sha: str | None) -> str:
    with conn.cursor(row_factory=dict_row) as cur:
        prof = cur.execute("SELECT slug FROM ai_model_profiles WHERE id = %s", (job["model_profile_id"],)).fetchone()
        latest = cur.execute(
            """SELECT version, provider_id, provider_model, base_model FROM ai_model_versions WHERE model_profile_id = %s
               ORDER BY string_to_array(version, '.')::int[] DESC LIMIT 1""",
            (job["model_profile_id"],),
        ).fetchone()
        version = bump_minor(latest["version"]) if latest else "1.0.0"
        provider_id = job["target_provider_id"] or latest["provider_id"]
        provider_model = latest["provider_model"] if latest and latest["base_model"] == job["base_model"] else job["base_model"]
        adapter_name = re.sub(r"[^a-zA-Z0-9._-]", "-", f"{prof['slug']}-v{version}")[:100]
        row = cur.execute(
            """INSERT INTO ai_model_versions (model_profile_id, owner_id, version, base_model, base_model_revision, provider_id, provider_model,
                                              adapter_path, adapter_name, training_job_id, model_config, status, notes, created_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'ready', %s, %s) RETURNING id""",
            (job["model_profile_id"], job["owner_id"], version, job["base_model"], base_sha or job["base_model_revision"], provider_id,
             provider_model, adapter_dir, adapter_name, job["id"],
             Jsonb({"trainingJobId": job["id"], "datasetSnapshotHash": job["dataset_snapshot_hash"], "metrics": metrics}),
             f"LoRA adapter from training job {job['id']}. Not deployed: evaluate it first.", job["created_by"]),
        ).fetchone()
        return row["id"]


def process_job(conn: psycopg.Connection, cfg: WorkerConfig, job: dict, hw: dict, hb: Heartbeat | None = None) -> str:
    job_id = str(job["id"])
    rep = DbReporter(conn, job_id)
    cfgj = job["configuration"]
    cuda = hw["cuda_available"]
    if hb:
        hb.current_job = job_id
    try:
        if cfgj.get("requiresGpu", True) and not cuda:
            rep.log("error", f"{GPU_UNAVAILABLE}. This worker has no CUDA GPU.")
            finish(conn, job_id, "unavailable", f"{GPU_UNAVAILABLE}. The job needs a CUDA GPU worker.", hardware=hw)
            return "unavailable"
        if job["training_method"] == "qlora" and "bitsandbytes" not in hw["software"]:
            finish(conn, job_id, "unavailable", "QLoRA needs bitsandbytes on a CUDA worker; it is not installed here.", hardware=hw)
            return "unavailable"
        try:
            splits = load_snapshot(conn, str(job["dataset_id"]), job["dataset_snapshot_hash"])
        except SnapshotMismatch as e:
            rep.log("error", str(e))
            finish(conn, job_id, "failed", str(e))
            return "failed"
        conn.execute(
            "UPDATE ai_training_jobs SET status = 'running', started_at = now(), hardware = %s, status_reason = 'Training.' WHERE id = %s",
            (Jsonb(hw), job_id),
        )
        rep.log("info", f"Worker {cfg.worker_id}: {len(splits['train'])} train / {len(splits['validation'])} validation / {len(splits['test'])} test examples")
        job_dir = os.path.join(cfg.artifacts_dir, job_id)
        os.makedirs(job_dir, exist_ok=True)

        from .train import run_training

        started = time.time()
        result = run_training(job, splits, job_dir, rep, cuda)
        if result.status == "cancelled":
            finish(conn, job_id, "cancelled", "Cancelled by the owner.", metrics=result.metrics)
            return "cancelled"
        version_id = publish_version(conn, job, result.adapter_dir, result.metrics, result.base_model_sha)
        shutil.rmtree(os.path.join(job_dir, "checkpoints"), ignore_errors=True)
        conn.execute(
            """INSERT INTO ai_usage_events (owner_id, workspace_id, model_profile_id, model_version_id, operation, provider_type, input_tokens, usage_source, latency_ms)
               VALUES (%s, %s, %s, %s, 'training', %s, %s, 'provider', %s)""",
            (job["owner_id"], job["workspace_id"], job["model_profile_id"], version_id, "cuda" if cuda else "cpu", result.train_tokens, int((time.time() - started) * 1000)),
        )
        conn.execute(
            """INSERT INTO ai_audit_events (actor_id, workspace_id, action, resource_type, resource_id, metadata)
               VALUES (NULL, %s, 'training.version_published', 'model_version', %s, %s)""",
            (job["workspace_id"], str(version_id), Jsonb({"jobId": job_id, "worker": cfg.worker_id})),
        )
        finish(conn, job_id, "succeeded", "Training finished. A new version was created; evaluate it before deploying.",
               progress=1, metrics=result.metrics, artifact_uri=f"file://{result.adapter_dir}", result_version_id=version_id)
        rep.log("info", f"Published model version {version_id}")
        return "succeeded"
    except Exception as e:  # noqa: BLE001 - every failure must be recorded on the job
        rep.log("error", scrub("".join(traceback.format_exception_only(type(e), e))))
        finish(conn, job_id, "failed", scrub(f"Training failed: {e}"))
        return "failed"
    finally:
        if hb:
            hb.current_job = None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true", help="process at most one job, then exit")
    args = ap.parse_args()
    cfg = WorkerConfig.from_env()
    hw = hardware.detect()
    print(json.dumps({"worker": cfg.worker_id, "cuda": hw["cuda_available"], "gpus": hw["gpus"], "software": hw["software"]}), flush=True)
    if not hw["cuda_available"]:
        print(f"{GPU_UNAVAILABLE}: this worker accepts only CPU smoke-test jobs (models < 1B, allowCpu=true).", flush=True)
    hb = Heartbeat(cfg, hw)
    with psycopg.connect(cfg.database_url, autocommit=True) as conn:
        hb.beat(conn)
        hb.start()
        stopping = threading.Event()
        signal.signal(signal.SIGTERM, lambda *_: stopping.set())
        while not stopping.is_set():
            recover_stale_jobs(conn)
            job = claim(conn, cfg, hw["cuda_available"])
            if job:
                status = process_job(conn, cfg, job, hw, hb)
                print(json.dumps({"job": str(job["id"]), "status": status}), flush=True)
                hb.beat(conn)
                if args.once:
                    break
            elif args.once:
                break
            else:
                stopping.wait(cfg.poll_seconds)
        hb.stop.set()


if __name__ == "__main__":
    main()
