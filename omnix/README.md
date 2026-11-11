# OMNIX — Personal AI

A private, customisable and continuously improvable AI model inside OMNIX:
its own identity, a private knowledge base with cited answers, explicit
long-term memory, LoRA/QLoRA fine-tuning on approved data, a fixed
evaluation suite, versioning with a database-enforced deploy gate, an
external API, and a bilingual (Arabic RTL / English LTR) interface for
desktop, tablet and phone.

> OMNIX did not exist in any repository or database reachable from this
> project, so this directory is a new, self-contained OMNIX application. No
> existing database or project was modified. See
> [AI_MODEL_ARCHITECTURE.md](./AI_MODEL_ARCHITECTURE.md) §1.

## Documents

| | |
| --- | --- |
| [AI_MODEL_ARCHITECTURE.md](./AI_MODEL_ARCHITECTURE.md) | inspection findings, layers, base-model selection |
| [AI_MODEL_DATABASE.md](./AI_MODEL_DATABASE.md) | schema, ER diagram, RLS, migrations, Supabase/Neon |
| [AI_MODEL_API.md](./AI_MODEL_API.md) | auth, SSE chat, endpoints, errors (`/api/ai/openapi.json`) |
| [AI_MODEL_TRAINING.md](./AI_MODEL_TRAINING.md) | datasets, Python worker, GPU, adapters |
| [AI_MODEL_EVALUATION.md](./AI_MODEL_EVALUATION.md) | suite, gate, real results, retrieval calibration |
| [AI_MODEL_SECURITY.md](./AI_MODEL_SECURITY.md) | controls, how each is verified, known gaps |
| [AI_MODEL_DEPLOYMENT.md](./AI_MODEL_DEPLOYMENT.md) | local, production, rollback, troubleshooting |

## Quick start

```bash
npm install
PGPASSWORD=<postgres superuser password> scripts/dev-db.sh omnix_dev
cp .env.example .env.local        # fill OMNIX_SECRETS_KEY and the CHANGE_ME passwords (dev-db.sh prints them)
npm run db:migrate                # with MIGRATION_DATABASE_URL set
npm run models:fetch              # dev model + embedder from Hugging Face
npm run dev                       # http://localhost:3200 → create an account → name your model
```

## Verify

```bash
npm run typecheck && npm run lint
npm test                          # unit (73)
npm run test:integration          # real PostgreSQL + real models (needs scripts/dev-db.sh)
npm run test:worker               # Python worker (pytest)
BASE_URL=http://localhost:3200 node e2e/ui-walkthrough.mts   # browser walkthrough (Playwright)
npm run build
```

Integration tests run the real Qwen2.5-0.5B model and the real
multilingual-e5-small embedder on CPU, and the training test launches the
Python worker for a real (tiny) LoRA run — set `OMNIX_WORKER_PYTHON` to a
Python with `worker/requirements.txt` installed.

## Layout

```
db/migrations/        SQL + rollbacks          scripts/        migrate, seed, workers, model fetch
src/app/(app)/        UI screens               src/app/api/    route handlers
src/lib/ai/           identity, providers, prompt, context, memory, rag, tools, engine, eval, training, models
src/lib/auth|db|http|security                  tests/unit, tests/integration, e2e/
worker/               Python LoRA/QLoRA trainer
```
