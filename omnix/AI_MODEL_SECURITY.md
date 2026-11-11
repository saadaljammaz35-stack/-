# OMNIX Personal AI — Security

Each control lists where it lives and how it was verified. "Verified" means
an automated test that fails if the control is removed.

## 1. Identity and access

| Control | Where | Verified |
| --- | --- | --- |
| Passwords: scrypt N=2^15 r=8 p=1, NFKC-normalised, constant-time compare; dummy hash for unknown emails so timing and message do not reveal accounts | `lib/auth/password.ts`, `session.ts` | unit + `security.test.ts` (same message for unknown/known) |
| Account lockout: 5 failures → 1 min, doubling, capped at 1 h (in the database) | `omnix_auth_record_failure` | `security.test.ts` (429 + Retry-After) |
| Sessions: 256-bit random token, only its SHA-256 stored, HttpOnly + SameSite=Lax (+ Secure in production), revocable | `session.ts`, `sessions` | `chat.test.ts`, logout route |
| API keys: `omx_<prefix>_<secret>`, SHA-256 stored, token shown once, scoped (`chat`, `models:read`, `knowledge:read/write`, `usage:read`), expiry, revocation, `last_used_at` | `ai_api_keys` | `security.test.ts` (revoked key → 401 at once), `chat.test.ts` (scope 403) |
| API keys reach **only deployed versions**; account, key, model and training management are session-only | `resolveModel`, `route.auth({ sessionOnly })` | `chat.test.ts` (412, 403) |
| CSRF: cookie-authenticated writes must carry a same-origin `Origin` | `lib/http/route.ts` | `chat.test.ts` (cross-origin → 403) |
| Rate limits: PostgreSQL-backed sliding window shared across instances (login, register, chat, uploads, evaluations, key creation) | `lib/http/rate-limit.ts` | exercised in every integration run |

## 2. Data isolation

- **Row level security in PostgreSQL**, forced on every user-data table,
  keyed on a transaction-local `app.user_id` (a pooled connection can never
  carry one user's identity into another request). Private by default:
  models, versions, conversations, messages, memories, datasets, jobs,
  evaluations and usage are owner-only; knowledge documents are shared with
  workspace members (writes: uploader or workspace admin).
- The application's database role owns nothing and must not be superuser or
  `BYPASSRLS` — production refuses to start otherwise.
- **Verified at the SQL level** (`security.test.ts`): with the app role and
  *no WHERE clause*, user B sees zero rows of user A in 11 tables; with no
  identity, every table returns zero rows; cross-user inserts and updates are
  refused by policy; the worker role cannot read messages or users and
  cannot publish a deployed version.
- Memory is per user, per workspace (optionally per model) and recalled
  top-k by relevance — never "all memories into every prompt".

## 3. Secrets

- Provider API keys are **never stored in plain text**: AES-256-GCM sealed
  values whose key (`OMNIX_SECRETS_KEY`) lives outside the database, or
  pointers to `OMNIX_PROVIDER_SECRET_*` environment variables (platform
  admins only, enforced by an RLS check). A `CHECK` rejects any other format.
  The key is never returned by any API; the UI shows the last 4 characters.
  Verified: `security.test.ts` reads the row with the owner role and checks
  the plaintext is absent.
- **Logs are redacted** centrally (keys, JWTs, DSN passwords, private keys,
  bearer tokens, Luhn-valid card numbers, sensitive field names). The Python
  worker scrubs its log lines too.
- **Model output is redacted while streaming.** Text is released only at
  whitespace boundaries, so a key is never split across chunks and always
  checked whole; private-key blocks are held until complete. Unit tests feed
  a key one character at a time and a key block whose end arrives in the last
  characters (this second test found and fixed a real leak).
- `.env` is git-ignored; `.env.example` holds no values.

## 4. Prompt injection and untrusted content

- Retrieved chunks and memories go into a **separate system message** inside
  `<source>` / `<memory>` blocks; the rules say they are **data, not
  instructions**. Tag-like sequences inside them are neutralised
  (`escapeData`), so a document cannot close the block and continue as
  instructions (unit-tested).
- Platform rules come **after** the owner's custom instructions, so profile
  text cannot quietly override them.
- **Strict knowledge mode** answers "not found" without calling the model at
  all when nothing relevant is retrieved.
- Citations are validated: only ids of sources actually provided survive.
- Honest limits: an LLM can still be persuaded by a sufficiently clever
  document. These measures reduce the risk; they do not eliminate it, which
  is why tools are allow-listed and authorised outside the model.

## 5. Tools and the network

- The model can only *request* a tool. `authorizeToolCall` checks the
  model's allow-list, the API key's scopes, the per-answer call limit and the
  arguments (zod) before anything runs, and tools run as the caller inside
  RLS. Tools have no direct access to platform tables or files.
- `fetch_url` is **off by default** (`OMNIX_ENABLE_FETCH_TOOL`). When on, it
  resolves DNS, rejects private, loopback, link-local, CGNAT, metadata and
  multicast ranges (IPv4, IPv6, IPv4-mapped), connects to the **validated
  IP** (no second lookup → no DNS rebinding), follows no redirects, and caps
  size and time.
- User-registered provider endpoints must be public `https://` hosts (same
  SSRF check plus a database `CHECK`). Internal inference servers (Ollama,
  vLLM) are configured only by operators through server environment
  variables and must not be exposed publicly.

## 6. Uploads

- Type is decided from **content** (PDF magic bytes, OOXML package structure,
  strict UTF-8 without control characters, JSON/JSONL parse) and must agree
  with the extension; everything else is refused.
- Size: 25 MB knowledge files (checked from Content-Length before reading,
  then again on the bytes), 20 MB dataset files, 2 MB text bodies, 256 KB
  default JSON bodies. Extracted text ≤ 2 M characters, ≤ 5,000 chunks.
- Client filenames are never used in storage paths (UUID + SHA-256 only);
  storage paths are checked against traversal; files are written 0600.
- Scanned PDFs without a text layer are refused with a clear message (no OCR).

## 7. Training data and privacy

- Conversations are **never** training data by default; adding an answer
  requires `consent: true`, which is recorded on the item (`CHECK`) and in the
  audit log.
- Datasets need a **rights confirmation** before any job.
- Items containing phone numbers, national IDs, IBANs, card numbers, emails,
  keys or passwords are flagged and excluded from training.
- Memories refuse passwords, keys, card/bank numbers and national IDs
  outright.

## 8. Audit

`ai_audit_events` records model creation and changes, versions, deployments,
role changes, provider registration, API key creation/revocation, uploads,
deletions, dataset validation, rights, consent, training jobs and external
API completions — with request id. It is append-only in the database
(UPDATE, DELETE and TRUNCATE raise).

## 9. HTTP

Security headers on every response: CSP (`default-src 'self'`,
`frame-ancestors 'none'`), HSTS, `X-Content-Type-Options`, `X-Frame-Options:
DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP. Errors are structured
(`{error:{code,message,requestId}}`); database errors are mapped to stable
codes without leaking SQL; RLS denials surface as 403/404 without revealing
whether a row exists. The health endpoint logs its failure reason (redacted)
but returns no configuration.

### Generated apps (App Studio)

Model-written code is untrusted. It is served from `/preview/…` and `/p/…`
with `Content-Security-Policy: sandbox allow-scripts allow-forms allow-modals
allow-popups allow-downloads` (no `allow-same-origin`), so it runs in an
opaque origin: it cannot send the owner's cookies with credentials, read
OMNIX responses (no CORS), or touch the studio page; writes from it fail the
same-origin check. Those paths get `frame-ancestors 'self'`, `Referrer-Policy:
no-referrer` (the preview token never leaks to third-party scripts) and no
`X-Frame-Options: DENY`; every other path keeps the strict policy. Preview
tokens are HMAC-signed (key derived from `OMNIX_SECRETS_KEY`), name one
version and its owner, and expire after 24 h; the files are still read under
that owner's RLS. Public links use a random 14-character slug and a
`SECURITY DEFINER` function that returns only the published version.
Paths are restricted to safe relative names with an allow-listed extension.

## 10. Not covered (be aware)

- No MFA and no email verification or password reset flow yet.
- No malware scanning of uploads (content-type and size checks only).
- Rate limits key on user or (when `OMNIX_TRUST_PROXY=true`) the first
  `X-Forwarded-For` address; only enable that behind a proxy you control.
- In-process ONNX inference is a development path; production should use a
  separate inference server.
- A penetration test by an independent party has not been done.
- A published app is public content on the OMNIX host; the owner is
  responsible for what they publish (there is no content moderation).
