"""LoRA / QLoRA supervised fine-tuning with Hugging Face PEFT + TRL SFTTrainer."""
from __future__ import annotations

import hashlib
import json
import math
import os
import time
from dataclasses import dataclass
from typing import Any, Protocol


class Reporter(Protocol):
    def log(self, level: str, message: str) -> None: ...
    def metric(self, **kw: Any) -> None: ...
    def progress(self, fraction: float) -> None: ...
    def should_cancel(self) -> bool: ...


@dataclass
class TrainResult:
    status: str  # succeeded | cancelled
    adapter_dir: str | None
    metrics: dict[str, Any]
    base_model_sha: str | None
    train_tokens: int


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def run_training(job: dict[str, Any], splits: dict[str, list[dict]], job_dir: str, reporter: Reporter, cuda: bool) -> TrainResult:
    # Imported here so the worker can start, register and report hardware
    # even on a machine where the training stack is broken.
    import torch
    from datasets import Dataset
    from peft import LoraConfig
    from transformers import AutoModelForCausalLM, AutoTokenizer, TrainerCallback
    from trl import SFTConfig, SFTTrainer

    cfg = job["configuration"]
    hp = cfg["hyperparameters"]
    method = job["training_method"]
    base = job["base_model"]
    revision = job.get("base_model_revision") or None
    torch.manual_seed(int(hp.get("seed", 42)))

    base_sha = None
    try:
        from huggingface_hub import model_info

        base_sha = model_info(base, revision=revision).sha
    except Exception as e:  # noqa: BLE001 - metadata is best-effort; training still pins `revision`
        reporter.log("warning", f"Could not resolve the base model commit: {e}")

    reporter.log("info", f"Loading tokenizer and base model {base} (revision {revision or 'main'}) on {'GPU' if cuda else 'CPU'}")
    tok = AutoTokenizer.from_pretrained(base, revision=revision)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token

    model_kwargs: dict[str, Any] = {"revision": revision}
    if method == "qlora":
        from transformers import BitsAndBytesConfig

        model_kwargs["quantization_config"] = BitsAndBytesConfig(
            load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=torch.bfloat16
        )
        model_kwargs["device_map"] = "auto"
    elif cuda:
        model_kwargs["dtype"] = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
        model_kwargs["device_map"] = "auto"
    else:
        model_kwargs["dtype"] = torch.float32
    model = AutoModelForCausalLM.from_pretrained(base, **model_kwargs)
    if method == "qlora":
        from peft import prepare_model_for_kbit_training

        model = prepare_model_for_kbit_training(model)

    lora = LoraConfig(
        r=int(hp["loraR"]), lora_alpha=int(hp["loraAlpha"]), lora_dropout=float(hp["loraDropout"]),
        target_modules="all-linear", task_type="CAUSAL_LM",
    )

    train_ds = Dataset.from_list(splits["train"])
    eval_ds = Dataset.from_list(splits["validation"]) if splits["validation"] else None
    test_ds = Dataset.from_list(splits["test"]) if splits["test"] else None

    # Exact training-token count with the model's own tokenizer.
    train_tokens = 0
    for ex in splits["train"]:
        # BatchEncoding is a Mapping but not a dict subclass: ask for the dict form explicitly.
        enc = tok.apply_chat_template(ex["prompt"] + ex["completion"], tokenize=True, return_dict=True)
        train_tokens += len(enc["input_ids"])

    steps_per_epoch = max(1, math.ceil(len(train_ds) / (int(hp["batchSize"]) * int(hp["gradientAccumulationSteps"]))))
    max_steps = int(hp["maxSteps"]) if hp.get("maxSteps") else -1
    total_steps = max_steps if max_steps > 0 else math.ceil(steps_per_epoch * float(hp["epochs"]))
    log_every = max(1, total_steps // 50)

    args = SFTConfig(
        output_dir=os.path.join(job_dir, "checkpoints"),
        num_train_epochs=float(hp["epochs"]),
        max_steps=max_steps,
        per_device_train_batch_size=int(hp["batchSize"]),
        per_device_eval_batch_size=int(hp["batchSize"]),
        gradient_accumulation_steps=int(hp["gradientAccumulationSteps"]),
        learning_rate=float(hp["learningRate"]),
        # transformers 5: a float in [0, 1) is a ratio of total steps (replaces warmup_ratio).
        warmup_steps=min(float(hp["warmupRatio"]), 0.99),
        lr_scheduler_type="cosine",
        logging_steps=log_every,
        eval_strategy="steps" if eval_ds is not None else "no",
        eval_steps=max(1, total_steps // 5),
        save_strategy="steps",
        save_steps=max(1, total_steps // 3),
        save_total_limit=2,
        max_length=int(hp["maxSeqLength"]),
        completion_only_loss=True,
        report_to="none",
        seed=int(hp.get("seed", 42)),
        bf16=bool(cuda and torch.cuda.is_bf16_supported()),
        fp16=bool(cuda and not torch.cuda.is_bf16_supported()),
        use_cpu=not cuda,
        gradient_checkpointing=cuda,
        dataloader_num_workers=0,
    )

    from .hardware import gpu_snapshot

    class OmnixCallback(TrainerCallback):
        cancelled = False
        _last_check = 0.0

        def on_log(self, a, state, control, logs=None, **kw):
            logs = logs or {}
            if not any(k in logs for k in ("loss", "eval_loss", "learning_rate", "grad_norm")):
                return  # end-of-run summaries (runtime, samples/s) are not a metric point
            util, mem = gpu_snapshot() if cuda else (None, None)
            reporter.metric(
                step=int(state.global_step),
                epoch=float(state.epoch or 0),
                train_loss=logs.get("loss"),
                eval_loss=logs.get("eval_loss"),
                learning_rate=logs.get("learning_rate"),
                grad_norm=logs.get("grad_norm"),
                gpu_utilization=util,
                gpu_memory_mb=mem,
            )
            if "loss" in logs:
                reporter.log("info", f"step {state.global_step}/{state.max_steps} loss={logs['loss']:.4f}")

        def on_step_end(self, a, state, control, **kw):
            reporter.progress(min(0.99, state.global_step / max(1, state.max_steps)))
            now = time.monotonic()
            if now - self._last_check > 5:
                self._last_check = now
                if reporter.should_cancel():
                    self.cancelled = True
                    control.should_training_stop = True
            return control

    cb = OmnixCallback()
    trainer = SFTTrainer(model=model, args=args, train_dataset=train_ds, eval_dataset=eval_ds, processing_class=tok, peft_config=lora, callbacks=[cb])
    trainable, total = trainer.model.get_nb_trainable_parameters()
    reporter.log("info", f"LoRA r={hp['loraR']} alpha={hp['loraAlpha']}: {trainable:,} trainable of {total:,} parameters ({100 * trainable / total:.3f}%)")
    reporter.log("info", f"Training on {len(train_ds)} examples ({train_tokens:,} tokens), {total_steps} optimizer steps")

    started = time.time()
    out = trainer.train()
    if cb.cancelled:
        reporter.log("warning", "Cancelled by the owner; no adapter was published.")
        return TrainResult("cancelled", None, {"steps": int(trainer.state.global_step)}, base_sha, train_tokens)

    metrics: dict[str, Any] = {
        "trainLoss": out.training_loss,
        "steps": int(trainer.state.global_step),
        "epochs": float(trainer.state.epoch or 0),
        "trainRuntimeSeconds": round(time.time() - started, 1),
        "trainExamples": len(train_ds),
        "trainTokens": train_tokens,
        "trainableParameters": int(trainable),
        "totalParameters": int(total),
    }
    if eval_ds is not None:
        metrics["validationLoss"] = trainer.evaluate(eval_dataset=eval_ds)["eval_loss"]
    if test_ds is not None:
        metrics["testLoss"] = trainer.evaluate(eval_dataset=test_ds, metric_key_prefix="test")["test_loss"]

    adapter_dir = os.path.join(job_dir, "adapter")
    trainer.save_model(adapter_dir)
    tok.save_pretrained(adapter_dir)
    weights = os.path.join(adapter_dir, "adapter_model.safetensors")
    manifest = {
        "jobId": job["id"],
        "baseModel": base,
        "baseModelRevision": revision,
        "baseModelSha": base_sha,
        "method": method,
        "hyperparameters": hp,
        "datasetSnapshotHash": job["dataset_snapshot_hash"],
        "metrics": metrics,
        "adapterSha256": _sha256(weights) if os.path.exists(weights) else None,
        "hardware": "cuda" if cuda else "cpu",
    }
    with open(os.path.join(adapter_dir, "omnix_training.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    metrics["adapterSha256"] = manifest["adapterSha256"]
    reporter.log("info", f"Adapter saved to {adapter_dir}")
    return TrainResult("succeeded", adapter_dir, metrics, base_sha, train_tokens)
