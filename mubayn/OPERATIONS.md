# MUBAYN operations runbook

## Production stack (recommended)

| Need | Service | Why | Approx. cost |
|---|---|---|---|
| Hosting, HTTPS, cron | Vercel **Pro** (region `fra1`) | Hobby is for non-commercial use only and its cron cannot run every minute | $20/month per member |
| Database | Neon (Postgres 16+, `aws-eu-central-1`, same region as functions) with point-in-time restore | managed backups, branching for staging | from ~$19/month (check current plans) |
| Evidence storage | Cloudflare R2 or AWS S3 (private bucket) | presigned URLs, lifecycle rules | R2: first 10 GB free, then ~$0.015/GB-month |
| E-mail | Resend + verified domain (SPF, DKIM, DMARC) | password reset and verification | free tier 3,000/month |
| AI | Anthropic API, `claude-opus-5-5` | vision + structured output | measured per report in Admin → Overview (estimate $0.10–$0.40) |
| Uptime alerts | any monitor (UptimeRobot, Better Stack) on `/api/health` | DB + overdue jobs | free tiers exist |

Set a **monthly spend limit** in the Anthropic console. The in-app quotas
(Admin → Limits) cap submissions, not dollars.

## Environment variables

All names are in `.env.example`. Production must have:
`APP_URL` (https), `DATABASE_URL` + `DATABASE_SSL=true`, `ENCRYPTION_KEY`
(`openssl rand -base64 32`), `STORAGE_DRIVER=s3` + `S3_*`, `EMAIL_DRIVER=resend`
+ `RESEND_API_KEY` + `EMAIL_FROM`, `ANTHROPIC_API_KEY`, `CRON_SECRET`
(`openssl rand -hex 24`), `TRUST_PROXY=true`, `SUPPORT_EMAIL`, `BUSINESS_*`.
The app refuses to start if a development driver is configured.

## Migrations

```bash
DATABASE_URL=... DATABASE_SSL=true npm run db:migrate
```
Run before deploying code that needs the new schema. Migrations are
transactional, ordered, checksummed (editing an applied file is refused) and
serialised with an advisory lock. Never edit an applied migration: add a new file.

## Backups and restore

- Database: enable point-in-time restore on the provider (Neon: history
  retention ≥ 7 days on a paid plan). Test a restore into a branch monthly:
  restore → point a staging deployment at it → log in → open a report.
- Bucket: enable versioning (S3) or rely on R2's durability plus a weekly
  `rclone sync` to a second bucket in another account/region.
- Secrets: keep `ENCRYPTION_KEY` in a password manager. Losing it makes admin
  MFA secrets unreadable (admins re-enrol; customer data is unaffected).

## Monitoring

- `/api/health` → 200 when the DB answers; includes `overdueJobs` (queued > 10 min).
  Alert on non-200 and on `overdueJobs > 0` for 15 minutes.
- Admin → Overview: AI spend, failure rate, time-to-report p50/p95, readiness list.
- Admin → Errors: unexpected exceptions grouped by cause, with stack and context.
- Admin → AI jobs: queue, attempts, last error per job; failure counts by kind.
- Vercel logs: every log line is JSON (`level`, `msg`, fields).

## Incidents

| Symptom | Check | Fix |
|---|---|---|
| Reports stuck in "queued" | Admin → AI jobs; `/api/health` overdueJobs; Vercel cron logs | confirm `CRON_SECRET` matches; run `curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/jobs` |
| Many `auth` failures | Admin → AI jobs failure kinds | rotate `ANTHROPIC_API_KEY`, redeploy, then "Retry analysis" on failed inspections |
| `rate_limited` from Anthropic | failure kinds | lower daily cap in Admin → Limits or raise the Anthropic tier |
| Uploads fail in browser | browser console CORS error | bucket CORS must allow PUT from `APP_URL` with `content-type` header |
| No e-mails | Admin → Customer → E-mails tab shows provider error | verify domain in Resend; check `EMAIL_FROM` |
| Wrong report published | Admin → Report → "Withdraw" (customer stops seeing it) then "Re-analyse" | |
| Data breach suspected | rotate all keys, revoke sessions (`UPDATE sessions SET revoked_at = now()`), preserve logs | Saudi PDPL regulations require notifying SDAIA within 72 hours of becoming aware (confirm current rules with counsel); notify affected users when required |

## Data requests

- Access: customers download their data themselves from Account (JSON). For a
  request by e-mail, verify identity and run the queries in `exportAccount`
  (`src/lib/accounts.ts`) for that user id.
- Deletion: customers delete from Account (files + rows). For a request by
  e-mail, verify identity, then disable the account in admin and ask the
  customer to delete it, or delete via SQL after removing `u/<user-id>/` from the bucket.
- Retention: nothing is kept after deletion except audit rows that hold the
  deleted id and no personal data.

## Rotations

| Secret | How |
|---|---|
| `CRON_SECRET` | change in Vercel env, redeploy |
| `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, S3 keys | create new key, update env, redeploy, delete old key |
| `ENCRYPTION_KEY` | changing it invalidates admin MFA secrets: clear `mfa_secret_enc`/`mfa_enabled_at` for admins and re-enrol |
| Customer sessions | `UPDATE sessions SET revoked_at = now() WHERE revoked_at IS NULL` |
