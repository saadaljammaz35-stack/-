"""Hardware detection. Reports only what is really there; never assumes a GPU."""
from __future__ import annotations

import platform
import shutil
import subprocess


def _nvidia_smi() -> list[dict]:
    if not shutil.which("nvidia-smi"):
        return []
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,memory.used,utilization.gpu", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10, check=True,
        ).stdout
    except (subprocess.SubprocessError, OSError):
        return []
    gpus = []
    for line in out.strip().splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) == 4:
            gpus.append({"name": parts[0], "memoryTotalMb": int(float(parts[1])), "memoryUsedMb": int(float(parts[2])), "utilization": float(parts[3])})
    return gpus


def detect() -> dict:
    """Returns {cuda_available, gpus, software}. Safe to call without torch installed."""
    software = {"python": platform.python_version()}
    cuda = False
    gpus: list[dict] = []
    try:
        import torch

        software["torch"] = torch.__version__
        cuda = bool(torch.cuda.is_available())
        if cuda:
            software["cuda"] = str(torch.version.cuda)
            for i in range(torch.cuda.device_count()):
                p = torch.cuda.get_device_properties(i)
                gpus.append({"name": p.name, "memoryTotalMb": int(p.total_memory / 1024 / 1024)})
    except ImportError:
        pass
    smi = _nvidia_smi()
    if smi:
        gpus = smi  # richer: includes live utilisation and memory use
    for mod in ("transformers", "peft", "trl", "datasets", "bitsandbytes"):
        try:
            software[mod] = __import__(mod).__version__
        except Exception:  # noqa: BLE001 - optional packages
            pass
    return {"cuda_available": cuda and len(gpus) > 0, "gpus": gpus, "software": software}


def gpu_snapshot() -> tuple[float | None, int | None]:
    """(utilisation %, memory used MB) of GPU 0, or (None, None) without a GPU."""
    smi = _nvidia_smi()
    if smi:
        return smi[0].get("utilization"), smi[0].get("memoryUsedMb")
    try:
        import torch

        if torch.cuda.is_available():
            return None, int(torch.cuda.memory_allocated(0) / 1024 / 1024)
    except ImportError:
        pass
    return None, None
