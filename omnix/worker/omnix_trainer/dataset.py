"""Dataset snapshot loading. Mirrors src/lib/ai/training/datasets.ts:snapshotHash exactly."""
from __future__ import annotations

import hashlib
from typing import Any


class SnapshotMismatch(Exception):
    pass


def snapshot_hash(items: list[dict[str, Any]]) -> str:
    lines = sorted(f"{i['item_hash']}:{i['split']}" for i in items)
    return hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()


def to_prompt_completion(messages: list[dict[str, str]]) -> dict[str, list[dict[str, str]]]:
    """Conversational prompt/completion: loss is computed on the final assistant answer only."""
    if not messages or messages[-1]["role"] != "assistant":
        raise ValueError("last message must be the assistant answer")
    return {
        "prompt": [{"role": m["role"], "content": m["content"]} for m in messages[:-1]],
        "completion": [{"role": "assistant", "content": messages[-1]["content"]}],
    }


def load_snapshot(conn, dataset_id: str, expected_hash: str) -> dict[str, list[dict]]:
    rows = conn.execute(
        "SELECT item_hash, split, content FROM ai_dataset_items WHERE dataset_id = %s AND validation_status = 'valid' ORDER BY item_hash",
        (dataset_id,),
    ).fetchall()
    items = [{"item_hash": r[0], "split": r[1], "content": r[2]} for r in rows]
    actual = snapshot_hash(items)
    if actual != expected_hash:
        raise SnapshotMismatch(
            "The dataset changed after this job was created (snapshot hash mismatch). Re-validate it and create a new job."
        )
    splits: dict[str, list[dict]] = {"train": [], "validation": [], "test": []}
    for it in items:
        splits[it["split"]].append(to_prompt_completion(it["content"]["messages"]))
    return splits
