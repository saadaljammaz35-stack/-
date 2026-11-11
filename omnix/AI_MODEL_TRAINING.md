# OMNIX Personal AI — Training

## 1. Status, plainly

| Question | Answer |
| --- | --- |
| Has your personal model been fine-tuned? | **No.** Fine-tuning a production base model (e.g. Qwen3-8B) needs a CUDA GPU, and none exists in the environment this was built in. |
| Does the training pipeline work? | **Yes, verified end to end**: the API queued a job, the Python worker claimed it and ran a real LoRA fine-tune of `Qwen/Qwen2.5-0.5B-Instruct` on CPU (4 steps, 19 training examples, 1,090 tokens, train loss 1.73 → 1.08, validation loss 1.88 → 1.16, 4.4 M trainable of 494 M parameters, 17.6 MB adapter), then published version 1.1.0 with the adapter. That run proves the pipeline; it is not a useful model. |
| What happens if I start a job with no GPU? | The job is queued and the UI says **"Training unavailable — GPU infrastructure required"**. CPU workers never claim GPU jobs; it starts as soon as a GPU worker comes online. |

## 2. Workflow (Training Lab)

1. **Create a dataset** (*Datasets → New dataset*).
2. **Add data**: upload `.jsonl` / `.json` (`{"messages":[…]}`, `{"prompt","completion"}` or `{"instruction","input","output"}`), add records through the API, or add a chat answer with **explicit consent** (*Chat → Add to dataset*). Conversations are never training data by default.
3. **Confirm data rights**: a statement of why you may train on it. Required before any job.
4. **Validate**: structure (roles alternate, last turn is the assistant answer), **de-duplication** (normalised content hash), **personal/secret data** (Saudi phone numbers, checksum-valid national IDs, Saudi IBANs, Luhn-valid cards, emails, API keys, private keys, password statements — flagged items are excluded), token length, and a **deterministic 80/10/10 split** derived from each item's hash (re-validation never reshuffles). Needs ≥ 10 valid items and a non-empty validation split.
5. **Review** items by status (*valid / invalid / duplicate / pii_flagged*).
6. **Choose the base model** from the verified catalog (causal LMs only; licence recorded).
7. **Configure LoRA / QLoRA**: epochs, learning rate, batch size, gradient accumulation, max sequence length, rank, alpha, max steps. QLoRA (4-bit) needs CUDA + bitsandbytes. CPU runs are allowed only for models under 1 B parameters and only with LoRA.
8. **Queue** → the worker checks hardware, **verifies the dataset snapshot hash** (training refuses if the data changed after queueing), trains, streams logs and metrics, saves checkpoints, evaluates on validation and test splits, saves the adapter + manifest, and **creates a new version that is never deployed automatically**.
9. **Evaluate** the new version and **compare** it with the base version on the same suite (`AI_MODEL_EVALUATION.md`).
10. **Deploy** — the owner presses Deploy; the database refuses unless a full evaluation passed.

Every job records: id, dataset snapshot hash and summary, base model and resolved commit, configuration, hardware, worker, timestamps, status and reason, logs, metric series, artifact location, adapter SHA-256 and result version.

## 3. The worker

```
worker/
  omnix_trainer/worker.py    claim → check hardware → verify snapshot → train → publish version
  omnix_trainer/train.py     PEFT LoraConfig(target_modules="all-linear") + TRL SFTTrainer
  omnix_trainer/dataset.py   snapshot hash (identical to the TypeScript one) + prompt/completion format
  omnix_trainer/hardware.py  torch.cuda + nvidia-smi; never assumes a GPU
  tests/                     pytest
```

- **Loss on answers only**: each conversation becomes TRL's conversational
  prompt/completion form, so the loss is computed on the assistant's final
  answer, not on the question.
- **Claiming** uses `FOR UPDATE SKIP LOCKED`; any number of workers can run.
- **Heartbeats** every 20 s into `ai_training_workers` (GPU names, memory,
  utilisation) and the job; a job whose worker stops responding for 10
  minutes is marked failed rather than left "running" forever.
- **Cancellation** is checked between steps; no adapter is published.
- **Logs** are scrubbed of tokens and connection strings before storage.
- The worker connects as `omnix_worker`: it can read datasets and write job
  progress, but cannot read users, messages or memories.

### Run it

```bash
cd worker
python -m venv .venv && . .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cu124   # GPU server (cpu index for smoke runs)
pip install -r requirements.txt          # + bitsandbytes on GPU servers for QLoRA
export WORKER_DATABASE_URL=postgres://omnix_worker_login:…@db/omnix
export OMNIX_ARTIFACTS_DIR=/srv/omnix/adapters    # shared with the serving host
export HF_TOKEN=…                                 # only for gated base models
python -m omnix_trainer.worker            # or --once
```

### GPU sizing (rule of thumb, not measured)

| Base | Serve bf16 | QLoRA fine-tune |
| --- | --- | --- |
| Qwen3-8B | ~20 GB (1× L4 24 GB / A10G) | ~13 GB (1× L4 / A10G / RTX 4090) |
| ALLaM-7B | ~17 GB | ~12 GB |
| Mistral-Small-24B | ~58 GB (A100 80 GB / H100) | ~25 GB |

## 4. Serving a trained adapter

The new version stores `adapter_path` and `adapter_name`. On **Deploy**, if
the version's provider is vLLM started with `--enable-lora` and
`VLLM_ALLOW_RUNTIME_LORA_UPDATING=True`, OMNIX calls
`/v1/load_lora_adapter` and then addresses the adapter by name. The adapter
directory must be readable by the vLLM host (shared volume or object
storage sync). For Ollama, build a model from the adapter with a Modelfile
(`FROM qwen3:8b` + `ADAPTER /path`) and create a version that points at that
model name.

## 5. Verification

- `tests/integration/training.test.ts` (10 tests): dataset upload, duplicate /
  PII / malformed detection, rights gate, unsafe-configuration refusals, GPU
  job stays queued with the GPU message, **real CPU LoRA run via the Python
  worker**, adapter + manifest on disk, version 1.1.0 not deployed, worker
  heartbeat, exact token usage, snapshot-mismatch refusal, cancellation,
  cross-user isolation.
- `worker/tests` (pytest, 9 tests): snapshot-hash parity with TypeScript,
  prompt/completion conversion, GPU-unavailable and QLoRA-without-bitsandbytes
  paths, truthful hardware report, log scrubbing.
