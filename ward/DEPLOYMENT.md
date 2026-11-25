# Deploying WARD + WARD OS

The app is a standard Next.js 16 server app. It needs **one Postgres database** and
**one way to process background jobs**. Pick a hosting shape:

| | Database | Background jobs |
|---|---|---|
| **A. Vercel + Supabase** (serverless) | Supabase Postgres (pooled URL) | Vercel Cron → `/api/cron`, plus inline processing after requests |
| **B. Single server / Docker / VM** | Any Postgres 15+ (or Supabase) | `npm run worker` as a long-running process |

## 1. Database (Supabase or any Postgres)

1. Create a project (do not reuse another brand's project). Copy the **Transaction pooler**
   connection string (port `6543`) — the driver runs with `prepare: false`, which the pooler requires.
2. From `ward/`:
   ```sh
   DATABASE_URL="postgresql://postgres.<ref>:<password>@<host>:6543/postgres" npm run db:migrate
   DATABASE_URL="..." WARD_FOUNDER_EMAIL=you@example.com npm run founder:create -- --name "اسمك"
   ```
   (`founder:create` prompts for the password if `WARD_FOUNDER_PASSWORD` is not set.)

   Everything is created in the `ward` schema with RLS; existing tables are untouched.
   The `ward` schema is not added to Supabase's exposed API schemas — keep it that way.
   Use either this migration runner **or** `supabase db push` on a database, not both.

## 2A. Vercel

1. Import the repository, set **Root Directory = `ward`**.
2. Environment variables (Production): `DATABASE_URL`, `CRON_SECRET` (24+ random chars),
   `WARD_SITE_URL`, at least one AI key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`,
   `DEEPSEEK_API_KEY`), optionally `RESEND_API_KEY` + `WARD_EMAIL_FROM`.
3. Add `ward/vercel.json` to schedule the job pump (Vercel sends `Authorization: Bearer $CRON_SECRET`):
   ```json
   { "crons": [{ "path": "/api/cron", "schedule": "*/5 * * * *" }] }
   ```
   Vercel Hobby only allows daily crons — use `"0 3 * * *"` there and rely on inline processing
   (jobs start right after the request that queued them), or upgrade for per-minute crons.
4. Long agent runs: `/api/cron` declares `maxDuration = 300`. A run that does not finish in one
   invocation is continued by the next one — state lives in Postgres, so nothing is lost.

## 2B. Server / Docker / VM

```sh
cd ward
npm ci
npm run build
npm run db:migrate
npm run start        # web (port 3100)
npm run worker       # background jobs, in a second process (systemd, pm2, a second container…)
```
Put the app behind HTTPS (the session cookie is `Secure` + `__Host-` in production).

## 3. After the first deploy

1. Sign in at `/os/login` with the founder account.
2. **Settings → AI providers → Test connections.**
3. **Settings → Models / prices:** set the models your accounts use and their real prices
   (USD per 1M tokens, one line per model: `anthropic:claude-sonnet-5-5 <input> <output>`).
   Until then, cost limits use a deliberately high estimate.
4. **Automations:** enable only what you want; each has its own cost cap.

## Operations

- Health: `GET /api/health` → `{ ok: true }` when the database answers.
- Kill switch: top bar of WARD OS, or `POST /api/os/kill-switch {"paused": true}`.
- Audit trail: `/os/audit` (append-only for the app role).
- Rebuild the typeface: `npm run fonts:build` (Python 3.10+, `pip install -r tools/ward-type/requirements.txt`).
