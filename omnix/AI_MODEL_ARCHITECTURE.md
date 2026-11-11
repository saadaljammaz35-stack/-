# OMNIX Personal AI — Architecture

> Status: implemented in `omnix/`. This file records what was found during
> inspection, the decisions taken because of it, and how the system is put
> together. Companion documents: `AI_MODEL_DATABASE.md`, `AI_MODEL_API.md`,
> `AI_MODEL_TRAINING.md`, `AI_MODEL_EVALUATION.md`, `AI_MODEL_SECURITY.md`,
> `AI_MODEL_DEPLOYMENT.md`.

---

## 1. Inspection findings (Phase 1)

Inspected on 2026-11-10 before any code was written.

### 1.1 Where OMNIX is — and is not

| Looked in | Result |
| --- | --- |
| This repository, every file on the working branch | No reference to "OMNIX" anywhere. The branch holds **NABD**, a FinTech monorepo (NestJS API, Next.js web/admin, Expo mobile, Prisma + SQL ledger). |
| All 15 branches of this repository | Each branch is a separate project (NABD, CRUST Bakery, Sahm coffee, Ma'a Allah app, Labina, Laqma, RAVENX, Mubayn, Damaan, Clinibot, a Roblox game, a film). **None is OMNIX.** |
| Other repositories the account can reach (`boire-`, `clinibot`) | GitHub code and repository search for "omnix": 0 results. |
| Supabase project `brbvgoumcxzsiwvrdjpj` | A queue-ticketing app (`businesses`, `branches`, `queues`, `tickets`, …). Not OMNIX. |
| Supabase project `hkpudmszpgdinkstojwu` ("دوري") | Empty `public` schema. Name matches the queue app, not OMNIX. |
| Neon project `shiny-king-39556024` ("mubayn") | The Mubayn inspection app (`inspections`, `findings`, `evidence`, …). Not OMNIX. |
| Folders shared from the user's computer | None shared with this session. |

**Conclusion.** There is no existing OMNIX codebase, authentication system or
database reachable from this environment. The rules "do not create a new
database if one exists", "do not replace existing auth", "do not duplicate
tables" therefore apply to *the projects that do exist*, and they were
respected:

- **No existing database was modified.** The three databases above belong to
  other products. Writing OMNIX tables into any of them would have mixed
  unrelated systems and their data.
- **NABD was not touched.** No file outside `omnix/` was changed.
- **No new cloud database was created.** That is an outward-facing,
  billable decision for the owner. Development and every test in this
  repository run against a local PostgreSQL 16 + pgvector 0.6.0; production
  needs a `DATABASE_URL` the owner provides (see `AI_MODEL_DEPLOYMENT.md`).

### 1.2 Repository convention followed

Every project branch here is built on the shared NABD base and adds **one
self-contained top-level directory** (`clinibot/`, `mubayn/`, `damaan/`,
`ravenx-esports/`). OMNIX follows the same convention: everything lives in
`omnix/`, with its own `package.json`, migrations and tests.

The stack mirrors the most recent sibling (`mubayn/`): Next.js App Router,
TypeScript, `pg` with hand-written SQL migrations, `zod`, `vitest`. A Python
worker is added for fine-tuning, because the training ecosystem (Transformers,
PEFT, TRL) is Python.

### 1.3 Resources available in this environment

| Resource | Available | Consequence |
| --- | --- | --- |
| GPU | **No** (`nvidia-smi` absent, `torch.cuda.is_available() == False`) | Real fine-tuning of a 7–9B model is not possible here. The worker refuses GPU jobs with *"Training unavailable — GPU infrastructure required"*. |
| CPU / RAM | 4 cores, 15 GB | A CPU smoke run of the pipeline on a 0.5B model is possible and was performed (clearly labelled; it is not a trained personal model). |
| Ollama | Not installable (GitHub release downloads are blocked by the network policy) | Adapter implemented and unit-tested against protocol fixtures; not exercised against a live Ollama here. |
| vLLM | Needs a GPU | Adapter implemented and unit-tested; not exercised live here. |
| Hugging Face Hub | Reachable | Model metadata verified live; ONNX weights downloaded for the in-process provider. |
| PostgreSQL 16 + pgvector 0.6.0 | Installed locally | All migrations, RLS and integration tests run for real. |

---

## 2. System overview

```
USER (browser · external app with API key · other OMNIX modules)
  │
  ▼
OMNIX AUTHENTICATION ─── session cookie (web) or Bearer API key (external)
  │                      src/lib/auth/*
  ▼
MODEL API GATEWAY ────── /api/ai/* route handlers
  │                      request id · zod validation · rate limit · audit
  ▼
PERSONAL AI ENGINE ───── src/lib/ai/engine/chat-engine.ts
  │
  ├─ A. Model Identity Layer     src/lib/ai/identity/        central config, no hard-coded name
  ├─ C. System Prompt Manager    src/lib/ai/prompt/          identity + grounding + safety rules
  ├─ D. Context Manager          src/lib/ai/context/         token budget, truncation order
  ├─ E. Memory Manager           src/lib/ai/memory/          explicit, per user, per workspace
  ├─ F. Retrieval (RAG)          src/lib/ai/rag/             hybrid vector + keyword, citations
  │
  ▼
MODEL PROVIDER ADAPTER ─ B. src/lib/ai/providers/            one interface, many backends
  │      ollama · vllm · openai_compatible · huggingface · local_onnx
  ▼
BASE OPEN-WEIGHT MODEL  (+ optional LoRA adapter loaded by the provider)
  │
  ▼
TOOL EXECUTION ──────── src/lib/ai/tools/                    allow-list + backend authorization
  │
  ▼
OUTPUT VALIDATION ───── src/lib/ai/engine/output-guard.ts    citation check, secret redaction
  │
  ▼
USER RESPONSE (SSE stream)

Off the request path:
  G. Fine-tuning pipeline   worker/omnix_trainer/  (Python · PEFT · TRL · LoRA/QLoRA)
  H. Evaluation engine      src/lib/ai/eval/       fixed suites, deterministic scorers
  J. Version manager        src/lib/ai/versions/   semver, deploy gate, rollback
  Node worker               scripts/ai-worker.mts  document ingestion · evaluation runs
```

### 2.1 Layer separation rules

1. **Identity never names a vendor model.** `ai_model_profiles` holds who the
   model *is* (name, personality, instructions, defaults). Which weights answer
   is a property of a **version** (`ai_model_versions.base_model`,
   `provider_id`, `adapter_path`). Swapping Qwen for ALLaM is a new version,
   not a code change.
2. **The engine never imports a provider.** It receives a `ModelProvider`
   from the registry, resolved from the version's `provider_id`.
3. **Retrieved content is data, not instructions.** Knowledge chunks and
   memories are wrapped in delimited, labelled blocks, and the system prompt
   tells the model to treat them as untrusted (see `AI_MODEL_SECURITY.md`).
4. **Tools never touch the database directly.** Every tool call goes through
   `authorizeToolCall()` with the caller's identity, and runs inside the
   caller's RLS context.

---

## 3. Model identity (Section 2 of the brief)

Defaults live in one place, `src/lib/ai/identity/model-config.ts`, validated
by a zod schema and persisted per profile. The display name is **not**
hard-coded anywhere in the UI or engine; the brief's placeholder
`[YOUR_NAME] AI` is a field the owner fills in when creating the model and can
change at any time on the Model Information screen.

| Field | Default |
| --- | --- |
| Display name | entered by the owner (form suggests `<name> AI`) |
| Slug | derived from the name, e.g. `your-name-ai` |
| Family | OMNIX Personal Intelligence |
| First version | 1.0.0 |
| Languages | Arabic, English; Arabic answers in native Arabic, understands Saudi dialect |
| Personality | intelligent, direct, accurate, professional, context-aware, helpful, technical |
| Editable | name, description, personality, system instructions, default language, creativity (temperature), precision mode, response length, tool limits, memory settings |

---

## 4. Provider layer (Section 4)

```ts
interface ModelProvider {
  generate(req): Promise<GenerateResult>
  stream(req): AsyncIterable<StreamEvent>
  healthCheck(): Promise<ProviderHealth>
  getCapabilities(model?): Promise<ProviderCapabilities>
  getModelInfo(model): Promise<ModelInfo>
  listModels(): Promise<ModelInfo[]>
  loadModel(model, opts?): Promise<void>
  unloadModel(model): Promise<void>
}
```

| Adapter | Protocol | Load / unload | Use |
| --- | --- | --- | --- |
| `ollama` | `/api/chat` NDJSON stream, `/api/show`, `/api/tags`, `/api/ps` | `keep_alive` on `/api/generate` | **Development default** when an Ollama server exists |
| `vllm` | OpenAI-compatible `/v1/chat/completions` SSE, `/health`, `/v1/models` | `/v1/load_lora_adapter`, `/v1/unload_lora_adapter` | **Production** (GPU) |
| `openai_compatible` | `/v1/chat/completions` SSE, `/v1/models` | not supported (reported, not faked) | Any compatible hosted endpoint |
| `huggingface` | HF Inference router / TGI (OpenAI-compatible) + Hub metadata | not supported | Hosted HF inference |
| `local_onnx` | In-process `@huggingface/transformers` (ONNX Runtime, CPU) | real pipeline load / dispose | Dev and CI without any model server; used for the live tests here |

Cross-cutting, in `providers/resilience.ts`: per-request timeout, caller
cancellation (`AbortSignal`), retry with full-jitter backoff **only before the
first token** (a half-streamed answer is never silently re-generated),
structured `ProviderError` codes, context-length validation before the call,
token usage from the provider when it reports it (else an estimate, labelled
as such), and health records written to `ai_model_providers`.

Inference servers are configured by URL in server-side environment variables.
They are reached only from the backend and must not be exposed publicly; user-
registered endpoints are restricted to public HTTPS hosts (SSRF guard).

---

## 5. Base model selection (Section 5)

Facts below were read live from the Hugging Face Hub API and each model's
`config.json` on 2026-11-10. **Quality columns are deliberately empty**: they
are filled only by running the evaluation suite against each candidate on real
hardware (see `AI_MODEL_EVALUATION.md`). No benchmark numbers were invented.

| Candidate | Licence | Params | Native context | Arabic-first | Notes |
| --- | --- | --- | --- | --- | --- |
| `Qwen/Qwen3-8B` | Apache-2.0 | 8.19 B | 40,960 | no (multilingual) | text CausalLM; mature PEFT/TRL/vLLM/Ollama support; native tool calling |
| `Qwen/Qwen3.5-9B` | Apache-2.0 | 9.65 B | 262,144 | no (multilingual) | vision-language architecture; heavier fine-tuning path |
| `Qwen/Qwen3.5-4B` | Apache-2.0 | 4.66 B | 262,144 | no | smaller VL option |
| `humain-ai/ALLaM-7B-Instruct-preview` | Apache-2.0 | 7.00 B | 4,096 | **yes** (Saudi) | strong Arabic intent; 4K context is tight for RAG + memory |
| `QCRI/Fanar-1-9B-Instruct` | Apache-2.0 | 8.78 B | 4,096 | **yes** | Gemma-2 base; 4K context |
| `inception42/jais-family-13b-chat` | Apache-2.0 | 13.46 B | — | **yes** | custom `JAIS` architecture (trust_remote_code) |
| `silma-ai/SILMA-9B-Instruct-v1.0` | Gemma terms | 9.24 B | 8,192 | **yes** | licence has use restrictions |
| `mistralai/Mistral-Small-3.1-24B-Instruct-2503` | Apache-2.0 | 24.0 B | 131,072 | tagged `ar` | needs ≥ 48 GB VRAM in bf16 |
| `meta-llama/Llama-3.1-8B-Instruct` | Llama 3.1 licence | 8 B | — | no | gated; licence conditions |
| `Qwen/Qwen2.5-0.5B-Instruct` | Apache-2.0 | 0.49 B | 32,768 | no | **dev/CI only** — runs on CPU |

**Selected default for production: `Qwen/Qwen3-8B`.** Reasons, all verifiable
from the table: permissive commercial licence, a context window large enough
for retrieval + memory + conversation, a plain causal-LM architecture with
first-class LoRA/QLoRA support in PEFT/TRL, served natively by vLLM and
Ollama, and native tool calling. **ALLaM-7B is registered as the Arabic
challenger**: it is the obvious candidate for Saudi-dialect quality, and the
evaluation centre is built precisely so the two can be compared on the same
Arabic suite before anything is deployed. The choice is stored in the database
(`ai_model_versions.base_model`, `base_model_revision`) and can be changed per
version.

**Selected for development and CI: `Qwen/Qwen2.5-0.5B-Instruct`** (ONNX build
`onnx-community/Qwen2.5-0.5B-Instruct` for the in-process provider). It is
small enough to run on this CPU so the full chat → stream → RAG path is tested
against a real model, not a mock.

**Embeddings:** `intfloat/multilingual-e5-small` (MIT, 384 dims, Arabic in its
training languages) in-process for development; `BAAI/bge-m3` (MIT, 1024 dims)
recommended for production via Ollama or a TEI/vLLM embeddings endpoint. The
schema stores the embedding model per chunk and indexes each model separately,
so dimensions never mix (see `AI_MODEL_DATABASE.md`).

---

## 6. Request lifecycle — one chat turn

1. **Authenticate** (cookie session or API key) → `userId`, `workspaceId`, scopes.
2. **Rate-limit** per user and per route (PostgreSQL-backed, shared across instances).
3. **Validate** body with zod; attach `X-Request-Id`.
4. **Open an RLS transaction**: `SET LOCAL app.user_id = <userId>`. Every query
   after this point is filtered by PostgreSQL policies as well as by the code.
5. **Resolve model**: profile → requested version, else deployed version, else
   latest ready version (marked *preview*). API keys may only use deployed versions.
6. **Persist** the user message.
7. **Recall memories** (if enabled): top-k by similarity, owner + workspace + profile only.
8. **Retrieve knowledge**: hybrid search (pgvector cosine + PostgreSQL full-text
   on Arabic-normalised text), fused with Reciprocal Rank Fusion, score threshold.
   In `strict` mode with no hit above threshold, the engine answers *"not found
   in your knowledge base"* without calling the model.
9. **Build prompt**: identity → behaviour rules → grounding rules → untrusted
   context blocks (sources numbered `[S1]…`) → history → user message.
10. **Budget context** for the model's real context length: drop oldest history,
    then lowest-ranked chunks; never drop system prompt or current message.
11. **Stream** from the provider over SSE: `meta` → `delta`* → `done` | `error`.
    Client "stop" aborts the provider request; partial text is saved as `cancelled`.
12. **Validate output**: citations must reference provided sources only;
    secret-shaped strings are redacted.
13. **Record** assistant message, usage event (tokens, latency, source of counts),
    audit event.

---

## 7. Integration with OMNIX (Section 15)

Game Studio, Design Studio and the Agent System do not exist in any reachable
codebase, so they were **not invented**. **App Studio** (Web/App Builder) was
built later — see below. What exists is the contract the other modules will use:

- **Model Hub** (`/hub`) — the personal model appears as a card: Use, Details,
  Knowledge, Train, Evaluate, Versions, API, Deploy.
- **Model roles** — `default`, `coding`, `reasoning`, `arabic`,
  `personal_assistant` are rows in `ai_model_roles` that bind a role to a
  profile, an optional pinned version and real generation overrides
  (temperature, max tokens, response length). `POST /api/ai/chat` accepts
  `role` instead of `modelProfileId`; a module asks for "the coding model" and
  gets whatever the owner bound.
- **Agents** call the same API with an API key whose scopes limit what they can
  do; tool calls pass the backend authorization layer.

### App Studio (`/ai/studio`)

The owner describes an app; the model bound to the `coding` role (else the
default model) writes it. Flow of one build turn
(`POST /api/ai/apps/{id}/generate`, `src/lib/ai/studio/`):

1. The current version's files and the last turns go to the model with
   instructions to answer in a fixed format: a short explanation, then each
   changed file as `<omnix-file path="…">complete content</omnix-file>`
   (`<omnix-delete path="…"/>` removes one).
2. `StudioOutputParser` parses the stream incrementally: explanation text goes
   to the chat, files are reported as they are written, unsafe paths and a file
   the answer stops in the middle of are refused with a warning.
3. A complete answer that changed something becomes a new **immutable
   version** (`ai_app_versions`, files as jsonb, ≤ 40 files, ≤ 200 KB each,
   ≤ 1 MB total). Older versions can be viewed and restored (as a new version).
4. The preview (`/preview/<signed token>/index.html`) and published apps
   (`/p/<slug>`) are served with `Content-Security-Policy: sandbox …` —
   an opaque origin, so generated code cannot use the owner's session or read
   OMNIX data. A small injected script replaces `localStorage` (which throws in
   an opaque origin) with an in-memory store and reports runtime errors to the
   studio, which offers "ask the model to fix it".

What it is not: there is no server-side code, database or package install per
app (that needs per-app sandboxed servers); apps are browser apps (HTML, CSS,
JavaScript, ES modules, React via CDN). Quality depends on the connected model.

---

## 8. Directory map

```
omnix/
  AI_MODEL_*.md                  the seven documents
  db/migrations/                 0001_core … 0005_background_work (+ .down.sql each)
  scripts/                       migrate · dev-db · seed · ai-worker (Node) · fetch-models
  src/app/(app)/                 17 pages: /ai dashboard, /hub, chat (+ conversation), model, knowledge, memory,
                                 training (+ job), datasets (+ dataset), evaluations (+ run),
                                 versions, deploy, api, usage
  src/app/api/                   49 route files, 68 handlers; /api/ai/openapi.json
  src/components/                design system + interactive pieces (Chat, ModelSettings, …)
  src/lib/auth/                  passwords, sessions, API keys
  src/lib/db/                    pool + RLS transactions (withUser / withAnon)
  src/lib/http/                  route wrapper, errors, rate limit, SSE
  src/lib/security/              SSRF guard, file sniffing, redaction, PII, sealed secrets
  src/lib/ai/                    identity · providers · embeddings · prompt · context · memory ·
                                 rag · tools · engine · eval · training · models
  tests/unit, tests/integration  vitest (real PostgreSQL + real models in integration)
  e2e/                           Playwright walkthrough of the UI
  worker/                        Python fine-tuning worker + pytest
```

## 9. What runs where at delivery

| Capability | State |
| --- | --- |
| Model identity, versions, roles, deploy gate | working, tested |
| Chat with streaming, stop, regenerate, sources, memory | working against a real open-weight model (in-process, CPU) |
| Ollama / vLLM / OpenAI-compatible / Hugging Face adapters | implemented; tested against protocol replays, not against live servers (none available here) |
| Knowledge base + hybrid RAG (Arabic + English) | working with the real multilingual-e5-small embedder |
| Datasets, validation, rights, consent | working, tested |
| Fine-tuning | pipeline verified with a real CPU LoRA run on a 0.5B model; **no personal model has been fine-tuned** (needs a GPU) |
| Evaluation | working; the 0.5B dev model scored 38.7 % and was blocked from deployment |
| UI (Arabic RTL / English LTR, light/dark, phone layout) | working; browser walkthrough passes |
| OMNIX modules (Web/App Builder, Studios, Agents) | not present anywhere reachable; integration contract = API + roles |
