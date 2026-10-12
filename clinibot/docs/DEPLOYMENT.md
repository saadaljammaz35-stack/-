# Deploying CliniBot

CliniBot has three deployable parts:

| Part | Where | Source |
| --- | --- | --- |
| Database (schema, RLS, functions, cron) | Supabase Postgres | `supabase/migrations/` |
| Server functions | Supabase Edge Functions | `supabase/functions/` |
| Web app (marketing site, dashboard, patient chat) | Any static host (Vercel, Netlify, Cloudflare Pages) | `web/` |

The production Supabase project already exists:

- Project: **clinibot** (`clpfcrsoxokhcbrzxgkt`), region **eu-central-1 (Frankfurt)**
- API URL: `https://clpfcrsoxokhcbrzxgkt.supabase.co`
- Publishable key: `sb_publishable_KjKeqOsrrUQIUY6rLhuajg_UAvQF4uA` (public by design; RLS protects data)

Read `SAUDI-COMPLIANCE.md` before putting real patient data into it: the
region is outside the Kingdom.

## 1. Database

All migrations in `supabase/migrations/` are applied to the project **except
the statements in `supabase/manual/apply_in_sql_editor.sql`** (three
functions that contain `DELETE`, plus two index clean-ups). The tool used to
set up the project needs an interactive approval for `DELETE` statements that
could not be given, so run that file once yourself:

1. Supabase Dashboard → SQL Editor → New query
2. Paste the whole of `supabase/manual/apply_in_sql_editor.sql` → Run

Until this is done, removing staff, deleting a clinic and the nightly
retention purge will fail (the purge job is already scheduled and will start
working as soon as the function exists).

Check:

```sql
select proname from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('remove_member', 'delete_organization', 'purge_expired_data');
-- expect 3 rows
select jobname, schedule from cron.job;  -- clinibot-retention-purge, 30 23 * * *
```

### Migration history and the Supabase CLI

The project's migration history was recorded with tool-generated version
numbers, not the file names in `supabase/migrations/`. Before using
`supabase db push` against this project for the first time, mark the local
files as applied so the CLI does not try to re-run them:

```bash
supabase link --project-ref clpfcrsoxokhcbrzxgkt
supabase migration repair --status applied 20261012090000 20261012090100 20261012090200 20261012090300 20261012090400
supabase migration list   # local and remote should now line up for these versions
```

New schema changes then go in new migration files and are applied with
`supabase db push`.

### Running the database tests

```bash
# any PostgreSQL 15+ where the connecting role is a superuser
PGHOST=localhost PGUSER=postgres PGPASSWORD=… bash supabase/tests/db/run.sh
```

## 2. Authentication settings (Dashboard → Authentication)

| Setting | Value |
| --- | --- |
| Site URL | your app URL, e.g. `https://app.clinibot.sa` |
| Redirect URLs | `https://app.clinibot.sa/auth/callback`, `https://app.clinibot.sa/reset-password`, `https://app.clinibot.sa/auth/accept-invite`, and `http://localhost:5173/**` for development |
| Email provider | enabled, **Confirm email on** |
| Minimum password length | 10 |
| Leaked password protection | on (requires a paid plan) |
| **Custom SMTP** | **required for production.** The built-in email service is heavily rate-limited and only delivers to members of your Supabase organisation, so sign-up, password reset and staff invitations will not reach clinics without it. Use a provider such as Amazon SES, Postmark or Resend with a verified sending domain. |
| Email templates | translate *Confirm signup*, *Invite user*, *Reset password* into Arabic (keep the `{{ .ConfirmationURL }}` links) |

## 3. Edge Function secrets (Dashboard → Edge Functions → Secrets)

| Secret | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | from console.anthropic.com. Without it the assistant reports *not configured* and cannot be enabled. |
| `CREDENTIALS_ENCRYPTION_KEY` | `openssl rand -base64 32` — keep a copy in your password manager; losing it means every clinic must re-enter WhatsApp credentials |
| `ALLOWED_ORIGINS` | `https://app.clinibot.sa` (comma-separated; add `http://localhost:5173` only on a development project) |
| `SITE_URL` | `https://app.clinibot.sa` |
| `RATE_LIMIT_SALT` | `openssl rand -hex 16` |
| `ANTHROPIC_MODEL` | optional, default `claude-opus-5-5` |
| `ANTHROPIC_EFFORT` | optional, default `low` |
| `WHATSAPP_GRAPH_VERSION` | optional, default `v26.0` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions by
Supabase automatically. **Never** put the service role key in the web app.

With the CLI:

```bash
supabase secrets set ANTHROPIC_API_KEY=… CREDENTIALS_ENCRYPTION_KEY=… \
  ALLOWED_ORIGINS=https://app.clinibot.sa SITE_URL=https://app.clinibot.sa RATE_LIMIT_SALT=…
```

## 4. Deploy the functions

```bash
cd clinibot
supabase functions deploy   # deploys every function; verify_jwt per supabase/config.toml
```

`public-chat`, `demo-request` and `whatsapp-webhook` run without JWT
verification (see `supabase/config.toml` for why); all others require a
signed-in user.

## 5. Deploy the web app

```bash
cd clinibot/web
npm ci
npm run build          # outputs web/dist
```

Environment variables at build time:

```
VITE_SUPABASE_URL=https://clpfcrsoxokhcbrzxgkt.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_KjKeqOsrrUQIUY6rLhuajg_UAvQF4uA
```

`web/vercel.json` (Vercel) and `web/public/_headers` (Netlify / Cloudflare
Pages) configure the single-page-app fallback and security headers.
Point your domain at the host, enable HTTPS, then add the domain to
`ALLOWED_ORIGINS`, *Site URL* and *Redirect URLs*.

## 6. After deploying — verify, don't assume

1. Open `/`: the marketing site loads in Arabic, toggles to English.
2. Submit the demo form; check the row in `demo_requests`.
3. Register, confirm the email, create a clinic.
4. Knowledge → add a service with a price and an FAQ.
5. Assistant → **Test**: a real reply from Claude appears and the status
   shows *Tested*. Then enable the assistant.
6. Settings → enable public chat; open `/c/<slug>` in a private window and
   chat; the conversation appears in the dashboard.
7. Book through the chat; the request appears under Appointments; confirm it
   with a time; *Notify customer* posts the confirmation to the chat.
8. Connect WhatsApp (`WHATSAPP-SETUP.md`) and repeat with a real phone.
9. Supabase → Advisors: no security errors.

## 7. Operations

- **Backups**: enable Point-in-Time Recovery on a paid plan; daily backups
  are included on Pro.
- **Logs**: Edge Function logs are JSON with request ids and no patient data.
  Users see the `request_id` in error messages; search logs by it.
- **Retention**: `clinibot-retention-purge` runs daily at 02:30 Riyadh time;
  each run writes a `retention.purge` audit entry with counts.
- **Key rotation**: see `SECURITY.md`.
- **Granting a paid plan** (until a payment provider is integrated): see
  `BILLING.md`.
