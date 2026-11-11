# OMNIX Personal AI — Deployment

## 1. Pieces

| Process | What | Scale |
| --- | --- | --- |
| **web** | Next.js app: UI + `/api/*` (`npm run build && npm start`) | stateless; any number behind a load balancer |
| **ai-worker** | Node: document ingestion + evaluation runs (`npm run ai-worker`) | 1+ |
| **trainer** | Python: LoRA/QLoRA jobs (`python -m omnix_trainer.worker`) | on GPU hosts; 0 is fine (jobs wait) |
| **PostgreSQL 16 + pgvector** | everything persistent | managed (Supabase / Neon / RDS) |
| **inference** | vLLM (GPU) and/or Ollama, reachable **only** from web/ai-worker | private network |
| **storage** | `OMNIX_STORAGE_DIR` (uploads) and `OMNIX_ARTIFACTS_DIR` (adapters) | persistent volume shared by web + ai-worker; adapters shared by trainer + vLLM |

## 2. Run locally (development)

Prerequisites: Node ≥ 22.18, PostgreSQL 16 with pgvector, Python 3.11+ (only for training).

```bash
cd omnix
npm install
PGPASSWORD=<superuser password> scripts/dev-db.sh omnix_dev      # roles, database, pgvector
cp .env.example .env.local                                        # then fill in (see below)
MIGRATION_DATABASE_URL=postgres://omnix_owner:omnix_owner_dev@localhost:5432/omnix_dev npm run db:migrate
npm run models:fetch            # downloads the dev chat model (~0.5 GB) + embedder (~0.12 GB) from Hugging Face
npm run db:seed                 # optional demo user; prints a one-time password
npm run dev                     # http://localhost:3200
```

With no model server, development uses the **in-process** provider
(Qwen2.5-0.5B-Instruct on CPU) — slow and low quality, but real. To use
Ollama instead: `ollama pull qwen3:8b && ollama pull bge-m3`, then set
`OLLAMA_URL=http://localhost:11434`, `EMBEDDING_PROVIDER=ollama`,
`EMBEDDING_MODEL=BAAI/bge-m3` and press *Knowledge → Re-index all*.

Background work runs inline in development (`OMNIX_INLINE_JOBS=true`). To
train: see `AI_MODEL_TRAINING.md` §3.

## 3. Production

### Database

1. Create the database, enable `vector`, run `npm run db:migrate` with the
   owner role (`MIGRATION_DATABASE_URL`). It takes a `pg_dump` backup before
   changing an existing schema — also take a provider snapshot (Neon branch /
   Supabase PITR) before every migration.
2. If several OMNIX databases share one PostgreSQL server and a migration
   stops with "role omnix_definer exists but … cannot use it", run the
   `GRANT` it prints (roles are server-wide).
3. Create two login roles **once**:
   ```sql
   CREATE ROLE omnix_app_login LOGIN PASSWORD '<strong>' IN ROLE omnix_app;
   CREATE ROLE omnix_worker_login LOGIN PASSWORD '<strong>' IN ROLE omnix_worker;
   ```
   `DATABASE_URL` uses the first (web + ai-worker), `WORKER_DATABASE_URL` the
   second (trainer). Neither may be superuser or `BYPASSRLS`; the app refuses
   to start otherwise.
4. Set `DATABASE_SSL=true` for managed databases.

### One GPU server for everything

`deploy/gpu-server/setup.sh` installs vLLM (Qwen3-8B + run-time LoRA),
Ollama (bge-m3 embeddings), the app, both workers and Caddy (HTTPS) on one
Ubuntu GPU machine — see `deploy/gpu-server/README.md` (sizing: ~48 GB GPU
memory to serve and train on one box). Written for this project; not yet run
on real GPU hardware.

### Serverless (Vercel) + Neon

No GPU and no model server: the web app runs on Vercel's functions,
PostgreSQL on Neon, and the owner connects their own OpenAI-compatible
provider (for example Groq or Google Gemini) while creating the model — the
key is sealed with `OMNIX_SECRETS_KEY` and stored in the database.

| Setting | Value |
| --- | --- |
| Root directory | `omnix` (framework Next.js, Node 22) |
| Function region | the database's region (`fra1` for Neon `eu-central-1`) |
| `DATABASE_URL` | `omnix_app_login` on the Neon **pooled** host; `DATABASE_SSL=true`, `DATABASE_POOL_MAX=5` |
| `OMNIX_SECRETS_KEY`, `OMNIX_PUBLIC_ORIGIN` | as for any production deployment (`https://<project>.vercel.app`) |
| `OMNIX_INLINE_JOBS=true` | no separate worker; ingestion and evaluations run after the response |
| `OMNIX_STORAGE_DIR=/tmp/omnix-storage` | the only writable path; files there do not survive the instance |
| `EMBEDDING_PROVIDER=none` | knowledge and memory use keyword search only |
| `OMNIX_TRUST_PROXY=true` | Vercel sets `X-Forwarded-For` |
| `OMNIX_REGISTRATION_OPEN` | `false` once the owner has an account |

What this setup does **not** do: semantic (vector) search, re-processing an
uploaded file after its instance is gone (the extracted text stays searchable),
training (needs a GPU host) and long evaluations beyond the function time
limit. `next.config.ts` leaves the in-process model runtime (~550 MB) out of
the function bundles when `VERCEL` is set.

### iPhone

The web app is installable: Safari → Share → **Add to Home Screen** opens
OMNIX full screen with its icon (`src/app/manifest.ts`).

A native app lives in `mobile/` (Expo; it opens your OMNIX server). The
GitHub Actions workflow `.github/workflows/omnix-ios.yml` builds an
**unsigned** `OMNIX-unsigned.ipa` on a GitHub-hosted Mac (artifact
`OMNIX-unsigned-ipa`); install it with Sideloadly or AltStore and your own
Apple ID (a free Apple ID must re-sign every 7 days). App Store / TestFlight
needs an Apple Developer account (`mobile/README.md`). The app needs a
running OMNIX server reachable over `https://`.

### Inference (GPU)

```bash
# Production default base model; LoRA adapters loaded at run time on deploy.
VLLM_ALLOW_RUNTIME_LORA_UPDATING=True \
vllm serve Qwen/Qwen3-8B --enable-lora --max-lora-rank 64 --max-model-len 32768 \
  --api-key "$VLLM_KEY" --host 10.0.0.12 --port 8000
```

Then `VLLM_URL=http://10.0.0.12:8000` and
`OMNIX_PROVIDER_SECRET_VLLM=$VLLM_KEY` on web + ai-worker. Keep port 8000 on
the private network only. Embeddings in production: `BAAI/bge-m3` through
Ollama or a TEI / vLLM embeddings endpoint (`EMBEDDING_PROVIDER`,
`EMBEDDING_URL`).

### Web

```bash
NODE_ENV=production npm run build
NODE_ENV=production npm start         # port 3200; put TLS + a reverse proxy in front
```

Production **refuses to start** unless: `OMNIX_SECRETS_KEY` is 32 random
bytes (base64, not a placeholder), `OMNIX_PUBLIC_ORIGIN` is `https://…`,
`DATABASE_URL` is not a development credential, model downloads are
disabled (`OMNIX_ALLOW_MODEL_DOWNLOAD=false`, the default), and the database
role passes the RLS check. Set `OMNIX_INLINE_JOBS=false` and run the
**ai-worker** as its own process. Set `OMNIX_TRUST_PROXY=true` only behind a
proxy you control.

### Checklist

- [ ] TLS everywhere; inference and database on private networks
- [ ] `OMNIX_SECRETS_KEY` generated with `openssl rand -base64 32` and stored in a secret manager (losing it makes stored provider keys unreadable)
- [ ] Separate DB roles for migrations, app and trainer
- [ ] Persistent, backed-up volumes for uploads and adapters
- [ ] Log shipping (logs are JSON lines, already redacted)
- [ ] `/api/health` in the load balancer (logs the cause when degraded)
- [ ] Evaluate a version before deploying it (the database enforces it)

## 4. Rollback

- **Model**: *Deployment → Take offline*, then deploy the previous version
  (it stays `ready`).
- **Schema**: `npm run db:rollback -- --i-understand-this-destroys-data`
  undoes the most recent migration after a `pg_dump`; prefer restoring a
  provider snapshot in production.

## 5. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `pgvector extension is not available` on migrate | install `postgresql-16-pgvector` / enable `vector` in Supabase or Neon |
| `pg_dump failed; refusing to change the schema` | the migration role cannot read every row: give it `BYPASSRLS` (it is the owner) or set `OMNIX_SKIP_BACKUP=1` only after taking a snapshot yourself |
| App logs `db.unsafe_role` / refuses to start | `DATABASE_URL` uses the owner or a superuser; use `omnix_app_login` |
| `/api/health` degraded | read the `health.failed` log line; in production usually the safety check (missing `OMNIX_SECRETS_KEY`, non-https origin, dev credentials) |
| "No model provider is configured" | set `VLLM_URL` or `OLLAMA_URL`, or `OMNIX_LOCAL_ONNX_ENABLED=true` in development |
| Chat answers "I couldn't find this in your knowledge base" | knowledge mode is Strict and nothing passed the relevance threshold; check *Knowledge → Search* scores, switch to Assist, or add the document |
| Training job stays queued with the GPU message | no GPU trainer is online; start `omnix_trainer.worker` on a CUDA host |
| Training job `failed: dataset changed` | the dataset was edited after the job was queued; validate again and create a new job |
| Upload refused (415) | the file content does not match an accepted type (scanned PDF without text, renamed binary, invalid JSON) |
| Local model download blocked | set `OMNIX_ALLOW_MODEL_DOWNLOAD=true` in development, or pre-place models in `OMNIX_MODELS_DIR` |
