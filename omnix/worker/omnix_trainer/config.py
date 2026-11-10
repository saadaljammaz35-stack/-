from __future__ import annotations

import os
import socket
from dataclasses import dataclass, field


@dataclass(frozen=True)
class WorkerConfig:
    database_url: str
    artifacts_dir: str
    worker_id: str
    poll_seconds: float = 10.0
    heartbeat_seconds: float = 20.0
    hf_cache_dir: str | None = None
    allow_cpu_jobs: bool = True
    extra: dict = field(default_factory=dict)

    @staticmethod
    def from_env() -> "WorkerConfig":
        url = os.environ.get("WORKER_DATABASE_URL")
        if not url:
            raise SystemExit("WORKER_DATABASE_URL is required (a login role that is a member of omnix_worker)")
        host = socket.gethostname()
        return WorkerConfig(
            database_url=url,
            artifacts_dir=os.path.abspath(os.environ.get("OMNIX_ARTIFACTS_DIR", "artifacts")),
            worker_id=os.environ.get("OMNIX_WORKER_ID", f"{host}-{os.getpid()}"),
            poll_seconds=float(os.environ.get("OMNIX_WORKER_POLL_SECONDS", "10")),
            heartbeat_seconds=float(os.environ.get("OMNIX_WORKER_HEARTBEAT_SECONDS", "20")),
            hf_cache_dir=os.environ.get("HF_HOME"),
            allow_cpu_jobs=os.environ.get("OMNIX_WORKER_ACCEPT_CPU_JOBS", "true").lower() == "true",
        )
