# OMNIX on one GPU server

`setup.sh` turns an Ubuntu 22.04/24.04 GPU machine (NVIDIA driver installed,
standard on GPU cloud images) into a complete OMNIX server:

| Service | What | Port |
| --- | --- | --- |
| `omnix-vllm` | vLLM serving `Qwen/Qwen3-8B` with run-time LoRA, tool calling, Qwen3 reasoning parser | 127.0.0.1:8000 |
| `ollama` | `bge-m3` embeddings | 127.0.0.1:11434 |
| `omnix-web` | the OMNIX app | 127.0.0.1:3200 |
| `omnix-ai-worker` | document ingestion + evaluations | — |
| `omnix-trainer` | LoRA/QLoRA training (GPU jobs only) | — |
| `caddy` | HTTPS for your domain (automatic certificates) | 443 |

## Size

One box that both serves Qwen3-8B and trains it needs **~48 GB of GPU memory**
(1× L40S, RTX 6000 Ada or A6000). With a 24 GB card (L4, A10G, RTX 4090) run
serving there with `VLLM_GPU_UTIL=0.90` and training on a second machine with
`WORKER_ONLY=1`.

## Steps

1. Create the database (PostgreSQL 16 + `vector`), run the role setup from
   `AI_MODEL_DEPLOYMENT.md` §3, and point a DNS A record at the server.
2. `sudo DOMAIN=omnix.example.com bash setup.sh` — first run writes
   `/etc/omnix/omnix.env` with fresh secrets and stops.
3. Fill the three `CHANGE_ME` database URLs, run the script again: it
   migrates, builds, gets the certificate and starts everything.
4. Open `https://omnix.example.com`, create your account and name your model.
   On iPhone: Safari → Share → **Add to Home Screen**.
5. Run *Evaluation → Run full evaluation*; deploy only if it passes.

Embeddings switch to `bge-m3`: its relevance threshold has **not** been
calibrated yet (see `AI_MODEL_EVALUATION.md` §4) — check *Knowledge → Search*
scores on your own documents.

**Status: written for this project, not yet run on real GPU hardware.**
Read `setup.sh` before running it.
