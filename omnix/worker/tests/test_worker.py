"""Unit tests for worker decisions. The connection is a recording stub (no database);
the end-to-end run against PostgreSQL lives in tests/integration/training.test.ts."""
from omnix_trainer import hardware
from omnix_trainer.config import WorkerConfig
from omnix_trainer.worker import GPU_UNAVAILABLE, bump_minor, process_job, scrub


class RecordingConn:
    def __init__(self):
        self.statements = []

    def execute(self, sql, params=None):
        self.statements.append((" ".join(sql.split()), params))
        return self


CFG = WorkerConfig(database_url="postgres://unused", artifacts_dir="/tmp/omnix-test-artifacts", worker_id="test-worker")
NO_GPU = {"cuda_available": False, "gpus": [], "software": {"python": "3"}}


def job(**over):
    j = {
        "id": "00000000-0000-0000-0000-000000000001",
        "configuration": {"requiresGpu": True, "hyperparameters": {}},
        "training_method": "lora",
        "dataset_id": "00000000-0000-0000-0000-000000000002",
        "dataset_snapshot_hash": "0" * 64,
    }
    j.update(over)
    return j


def test_gpu_job_on_cpu_worker_is_marked_unavailable_not_failed_or_faked():
    conn = RecordingConn()
    assert process_job(conn, CFG, job(), NO_GPU) == "unavailable"
    finish = [p for s, p in conn.statements if s.startswith("UPDATE ai_training_jobs SET status")]
    assert finish and finish[-1][0] == "unavailable"
    assert GPU_UNAVAILABLE in finish[-1][1]
    # Nothing was trained and no version was published.
    assert not any("ai_model_versions" in s for s, _ in conn.statements)


def test_qlora_without_bitsandbytes_is_unavailable():
    conn = RecordingConn()
    gpu = {"cuda_available": True, "gpus": [{"name": "X", "memoryTotalMb": 1}], "software": {}}
    assert process_job(conn, CFG, job(training_method="qlora"), gpu) == "unavailable"


def test_hardware_report_is_truthful_about_cuda():
    hw = hardware.detect()
    assert isinstance(hw["cuda_available"], bool)
    try:
        import torch

        assert hw["cuda_available"] == (torch.cuda.is_available() and len(hw["gpus"]) > 0)
    except ImportError:
        assert hw["cuda_available"] is False


def test_bump_minor():
    assert bump_minor("1.0.0") == "1.1.0"
    assert bump_minor("2.9.3") == "2.10.0"


def test_scrub_removes_secrets_from_logs():
    assert "hf_" not in scrub("token hf_abcdefghijklmnopqrstuvwxyz123 leaked")
    assert "secret" not in scrub("postgres://user:secret@db:5432/x")
