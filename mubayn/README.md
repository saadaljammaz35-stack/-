# MUBAYN · مُبيِّن

Evidence-based AI condition reports for used electronic devices. A customer
describes a device, uploads photos (and optionally a short video), and gets a
report in which every finding cites the exact photo or video frame it is based
on. Free to customers, bounded by operator-set quotas. Arabic and English.

> Status and launch blockers: **[LAUNCH.md](./LAUNCH.md)** (Arabic).

## Architecture

```
Browser ──HTTPS──▶ Next.js 16 (App Router, Node runtime)
   │                 ├─ pages: public site, customer app, admin console
   │                 ├─ /api/*: JSON routes (auth, inspections, evidence, reports, admin)
   │                 ├─ proxy.ts: per-request CSP nonce + security headers
   │                 └─ /api/cron/jobs: job runner (every minute)
   │
   └──presigned PUT/GET──▶ S3-compatible private bucket (evidence, frames, AI copies, PDFs)

Next.js ──▶ PostgreSQL (all state, job queue, rate limits, audit log)
        ──▶ Anthropic Messages API (claude-opus-5-5, structured output)
        ──▶ Resend (transactional e-mail)
        ──▶ headless Chromium (report PDF) · ffmpeg (video frames) · sharp (images)
```

One deployable. No separate queue service: jobs live in PostgreSQL and are
claimed with `FOR UPDATE SKIP LOCKED`.

### The analysis pipeline

1. **Upload** — browser asks for a presigned URL (size and type are signed),
   PUTs the file straight to the bucket with real progress, then calls
   `/complete`. The server downloads it, sniffs the real type from the bytes,
   decodes the image (min 320 px) or reads the video duration with ffmpeg,
   rejects duplicates and HEIC, records SHA-256.
2. **Submit** — checks e-mail verification, ≥ 4 photos, monthly per-user quota
   and daily global cap (both in the `settings` table, editable in admin), then
   enqueues a job. The job starts immediately in `after()`, and the cron runner
   picks up anything left.
3. **Analyse** — videos → evenly spaced frames (kept as `video_frame` evidence
   with timestamps). Each item is labelled `E1..En`, re-encoded (EXIF/GPS
   stripped, ≤ 1568 px), stored as the exact copy sent, and hashed. One Claude
   request with a strict JSON schema. The attempt row stores the manifest, the
   full raw response, request id, tokens and USD cost.
4. **Validate** — findings citing labels that were not sent are dropped
   (counted in `body.validation.dropped_findings`). No valid findings → failed
   attempt. Refusal / auth / bad request → failed, no retry. Overload, rate
   limit, network, invalid output → retried with backoff (1, 5, 15 min, max 3).
   Stuck jobs (worker died) are recovered after 10 minutes.
5. **Publish** — new report version (older ones `superseded`), findings with
   `evidence_ids uuid[]`, PDF rendered by Chromium with the cited evidence
   embedded, e-mail to the customer. **A failed analysis never creates a report.**

### Security model (summary — details in [SECURITY.md](./SECURITY.md))

- Passwords: scrypt (N=2¹⁵). Sessions: 256-bit random tokens, only SHA-256 stored,
  HttpOnly + Secure + SameSite=Lax cookie, revocable.
- Every customer query filters by `user_id`; foreign ids answer 404 exactly like
  missing ones. The acceptance suite checks this across two accounts.
- Admin: role granted only by CLI, TOTP enrolment mandatory, 60-minute idle
  timeout, every view of customer data written to `audit_log`.
- CSRF: same-origin check on every mutation + SameSite cookies. CSP with nonce,
  HSTS, frame-ancestors none, nosniff.
- Private bucket; files reachable only through 5-minute presigned links issued
  after an ownership check.
- Production refuses to start with development drivers (local storage, console
  e-mail, AI test double, http URL).

## Run locally

Requirements: Node 22, PostgreSQL 14+, ffmpeg (bundled via `ffmpeg-static`),
a Chromium binary for PDFs.

```bash
cd mubayn
npm ci
cp .env.example .env.local          # fill ENCRYPTION_KEY: openssl rand -base64 32
createdb mubayn_dev
npm run db:migrate
npm run dev                          # http://localhost:3100
```

With `EMAIL_DRIVER=console`, e-mails (verification, reset) are written to
`.storage/mail/*.json` instead of being sent. Without `ANTHROPIC_API_KEY`
analyses fail honestly and no report is produced.

With `EMAIL_DRIVER=none` nothing is ever e-mailed: accounts work straight after
sign-up, each customer gets a one-time recovery code (shown once, stored as a
SHA-256), `/forgot-password` resets the password with that code, the account
page issues a new one, and an admin can issue one for a customer who lost it.
Reports are shown on the site in every mode; they are never e-mailed.
`e2e/no-email.mts` tests this mode against a server started with it.

Make yourself admin: register, open the verification link, then
`DATABASE_URL=... npm run admin:grant -- you@example.com`, sign in again and
enrol an authenticator app at `/admin/mfa`.

## Tests

```bash
npx tsc --noEmit
npm test                              # unit tests (vitest)
# end-to-end (needs a running app, see .github/workflows/mubayn-ci.yml):
node e2e/mock-anthropic.mts 3999 &    # TEST DOUBLE for the AI API
BASE=http://localhost:3100 MOCK=http://localhost:3999 DATABASE_URL=... CRON_SECRET=... node e2e/acceptance.mts
NODE_PATH=$(npm root -g) node e2e/ui-walkthrough.cjs   # real-browser journey
```

`e2e/mock-anthropic.mts` is a local stand-in that returns schema-valid JSON
marked `[TEST OUTPUT]`. It exists to test the pipeline (citations, retries,
failures, versions, PDFs). It says nothing about real analysis quality, and
production configuration refuses it.

## Deploy

See [OPERATIONS.md](./OPERATIONS.md). Short version (Vercel):

1. Managed PostgreSQL (e.g. Neon, same region as the functions), run `npm run db:migrate`.
2. Private S3-compatible bucket (AWS S3 or Cloudflare R2) with CORS from `docs/s3-cors.json`
   and an access key limited by `docs/s3-iam-policy.json`.
3. Resend account with a verified sending domain.
4. Anthropic API key with a monthly spend limit set in the Anthropic console.
5. Vercel project with root directory `mubayn`, env vars from `.env.example`,
   `TRUST_PROXY=true`, `CRON_SECRET` set (Vercel Cron sends it automatically).
   The per-minute cron in `vercel.json` needs a paid plan.
6. Custom domain + HTTPS (automatic on Vercel), then run the production
   acceptance checklist in LAUNCH.md before telling anyone it is live.
