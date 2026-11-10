import pytest

from omnix_trainer.dataset import snapshot_hash, to_prompt_completion

# Computed with the TypeScript implementation (src/lib/ai/training/datasets.ts:snapshotHash).
TS_VECTOR = "528aa561140f927fa4fce0dcd9b1d3ee91dc14915f4a9675acb16c46d4f87274"


def test_snapshot_hash_matches_typescript():
    items = [
        {"item_hash": "b" * 64, "split": "validation"},
        {"item_hash": "a" * 64, "split": "train"},
        {"item_hash": "c" * 64, "split": "test"},
    ]
    assert snapshot_hash(items) == TS_VECTOR


def test_snapshot_hash_changes_when_a_split_changes():
    a = [{"item_hash": "a" * 64, "split": "train"}]
    b = [{"item_hash": "a" * 64, "split": "validation"}]
    assert snapshot_hash(a) != snapshot_hash(b)


def test_prompt_completion_keeps_history_and_targets_last_answer():
    msgs = [
        {"role": "system", "content": "s"},
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": "a1"},
        {"role": "user", "content": "q2"},
        {"role": "assistant", "content": "a2"},
    ]
    pc = to_prompt_completion(msgs)
    assert [m["content"] for m in pc["prompt"]] == ["s", "q1", "a1", "q2"]
    assert pc["completion"] == [{"role": "assistant", "content": "a2"}]


def test_prompt_completion_rejects_missing_answer():
    with pytest.raises(ValueError):
        to_prompt_completion([{"role": "user", "content": "q"}])
