# OMNIX Personal AI — API

The machine-readable contract is **`GET /api/ai/openapi.json`** (OpenAPI
3.1). It is generated from the same zod schemas the handlers validate with,
and a unit test fails if it documents a route or method that does not exist.

## Authentication

| Caller | How | Can do |
| --- | --- | --- |
| Browser | `omnix_session` HttpOnly cookie from `/api/auth/login`; writes need a same-origin `Origin` header | everything the owner can do |
| External app / OMNIX module | `Authorization: Bearer omx_<prefix>_<secret>` (create in *API settings*) | only the key's scopes; only **deployed** model versions; no account, key, model-settings or training management |

Scopes: `chat`, `models:read`, `knowledge:read`, `knowledge:write`, `usage:read`.

`/api/auth/register` and `/api/auth/login` are for the browser: like every
cookie-based write they require a same-origin `Origin` header (CSRF
defence). External applications authenticate with API keys, not passwords.

## Conventions

- Every response carries `X-Request-Id` (send your own `X-Request-Id`, 8–64 safe characters, to correlate).
- Errors: `{"error":{"code":"…","message":"…","details":…,"requestId":"…"}}`.
- Unknown body fields are rejected (`422 VALIDATION_FAILED`).
- `429 RATE_LIMITED` comes with `Retry-After`.

| Code | HTTP | Meaning |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | no / invalid session or key |
| `FORBIDDEN` | 403 | scope missing, cross-origin write, session-only route, SSRF-blocked URL |
| `NOT_FOUND` | 404 | does not exist **or** is not yours (never distinguished) |
| `VALIDATION_FAILED` | 422 | body invalid (`details` lists fields) |
| `CONFLICT` | 409 | duplicate (e.g. same file twice), evaluation already running |
| `DEPLOY_GATE` | 409 | version has no passed full evaluation |
| `PRECONDITION_FAILED` | 412 | e.g. API key on an undeployed model, dataset not validated / rights not confirmed |
| `PAYLOAD_TOO_LARGE` | 413 | body or file too large |
| `CONTEXT_TOO_LONG` | 413 | message cannot fit the model's context window |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | file content not an accepted type |
| `PROVIDER_UNAVAILABLE` / `PROVIDER_TIMEOUT` / `PROVIDER_ERROR` | 503 / 504 / 502 | model server problems |

## Chat

`POST /api/ai/chat/stream` — Server-Sent Events. Body (one of `modelProfileId`
/ `conversationId` / `role`, else the user's `default` role):

```json
{ "message": "ما رمز مشروع الواحة؟", "role": "default", "conversationId": "…optional…", "modelVersionId": "…optional…" }
```

Events:

```
event: meta   data: {"conversationId","userMessageId","assistantMessageId","model":{"displayName","version","baseModel","preview","provider"},"sources":[{"id":"S1","title","page","snippet",…}],"memoriesUsed":0}
event: delta  data: {"text":"…"}                     (repeated)
event: tool   data: {"name":"knowledge_search","status":"started|finished|denied"}
event: done   data: {"message":{"id","content","status":"complete|cancelled","cited":["S1"],"finishReason","usage":{"inputTokens","outputTokens","source":"provider|estimate"},"latencyMs","firstTokenMs"}}
event: error  data: {"code","message"}
```

Closing the connection stops generation on the server; the partial answer is
stored with status `cancelled`. Regenerate with
`{"conversationId": "…", "regenerateMessageId": "<assistant message id>"}`.

`POST /api/ai/chat` — same body, waits and returns `{conversationId, model, sources, message}`.

```bash
curl -N https://omnix.example/api/ai/chat/stream \
  -H "Authorization: Bearer $OMNIX_KEY" -H "Content-Type: application/json" \
  -d '{"message":"Summarise the leave policy","role":"default"}'
```

## Endpoint index

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET/PATCH /api/auth/me` |
| Chat | `POST /api/ai/chat` · `POST /api/ai/chat/stream` · `GET /api/ai/conversations` · `GET/PATCH/DELETE /api/ai/conversations/{id}` · `POST /api/ai/messages/{id}/feedback` |
| Models | `GET /api/ai/models` (hub) · `GET/POST /api/ai/models/personal` · `GET/POST /api/ai/models/personal/versions` · `GET/PATCH /api/ai/models/{id}` · `POST/DELETE /api/ai/models/{id}/deploy` · `GET /api/ai/base-models` · `GET/PUT /api/ai/roles` |
| Providers | `GET/POST /api/ai/providers` · `POST /api/ai/providers/{id}/health` · `GET /api/ai/providers/{id}/models` |
| Knowledge | `GET /api/ai/knowledge` · `POST /api/ai/knowledge/upload` (multipart) · `POST /api/ai/knowledge/text` · `POST /api/ai/knowledge/search` · `POST /api/ai/knowledge/reindex` · `GET/PATCH/DELETE /api/ai/knowledge/{id}` · `POST /api/ai/knowledge/{id}/reprocess` |
| Memory | `GET/POST /api/ai/memory` · `PATCH/DELETE /api/ai/memory/{id}` |
| Datasets | `GET/POST /api/ai/datasets` · `GET/DELETE /api/ai/datasets/{id}` · `GET/POST /api/ai/datasets/{id}/items` · `POST /api/ai/datasets/{id}/upload` · `POST /api/ai/datasets/{id}/validate` · `POST /api/ai/datasets/{id}/rights` · `POST /api/ai/datasets/from-message` |
| Training | `GET/POST /api/ai/training/jobs` · `GET /api/ai/training/jobs/{id}` · `POST /api/ai/training/jobs/{id}/cancel` · `GET /api/ai/training/infrastructure` |
| Evaluation | `GET/POST /api/ai/evaluations` · `GET /api/ai/evaluations/{id}` · `GET /api/ai/evaluations/compare` · `GET /api/ai/evaluations/suite` |
| Usage & audit | `GET /api/ai/usage` · `GET /api/ai/audit` |
| Keys | `GET/POST /api/ai/api-keys` · `DELETE /api/ai/api-keys/{id}` |
| System | `GET /api/health` · `GET /api/ai/openapi.json` |

The brief's paths are all present (`/api/ai/chat`, `/api/ai/chat/stream`,
`/api/ai/models`, `/api/ai/models/personal`, `/api/ai/models/personal/versions`,
`/api/ai/knowledge/upload`, `GET /api/ai/knowledge`, `DELETE /api/ai/knowledge/:id`,
`POST /api/ai/datasets`, `POST /api/ai/datasets/:id/validate`,
`POST /api/ai/training/jobs`, `GET /api/ai/training/jobs/:id`,
`POST /api/ai/evaluations`, `GET /api/ai/usage`, `POST/DELETE /api/ai/models/:id/deploy`).

## For other OMNIX modules

Web Builder, App Builder, Game Studio, Design Studio, Code Studio and the
agent system do not exist in any reachable codebase, so no integration code
was invented for them. Their contract is this API: call
`/api/ai/chat/stream` with `"role": "coding"` (or `reasoning`, `arabic`,
`personal_assistant`, `default`) using an API key with the `chat` scope. The
owner decides in *Deployment → Model roles* which model, which pinned
version and which temperature / length each role uses.
