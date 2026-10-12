# CliniBot | مساعدك الذكي في عيادتك

An AI receptionist for clinics in Saudi Arabia: it answers patients' questions
from each clinic's own approved information, takes appointment requests, and
hands anything medical or uncertain to the clinic's staff, over web chat and
the official WhatsApp Business Platform. Arabic first, English second.

> **Status:** see [`docs/STATUS.md`](docs/STATUS.md) for exactly what has been
> built, what has been verified against the live services, and what still
> needs credentials or approvals. CliniBot is **not** yet production-ready and
> does not claim regulatory compliance; see
> [`docs/SAUDI-COMPLIANCE.md`](docs/SAUDI-COMPLIANCE.md).

## What it does

| For | Feature |
| --- | --- |
| Patients | Web chat at `/c/<clinic>` and WhatsApp; answers about services, prices, hours and location from the clinic's approved knowledge; appointment **requests**; privacy notice and consent; delete-my-data and STOP commands |
| Reception | Inbox of web and WhatsApp conversations, take over from the assistant and reply, appointment request queue (new → contacted → confirmed → completed/cancelled) with assignment and internal notes, send confirmations only after the clinic confirms |
| Owners / admins | Services, prices and FAQs the assistant may use; assistant settings and a live test console; WhatsApp connection; staff and roles; retention and privacy settings; dashboard metrics; audit log |
| CliniBot (the business) | Multi-tenant SaaS with strict isolation, trials and plan limits enforced on the server, marketing site with demo requests |

## How it is built

```
clinibot/
  supabase/
    migrations/        PostgreSQL schema, RLS, column grants, SQL functions, cron
    functions/         Edge Functions (Deno): AI assistant, WhatsApp, staff actions
      _shared/         HTTP, auth, crypto, rate limiting, assistant, WhatsApp client
    tests/db/          129 database assertions (tenant isolation, roles, rules)
    manual/            SQL to run once in the SQL editor (see DEPLOYMENT.md)
  web/                 React + Vite + Tailwind app: marketing site, dashboard, patient chat
  docs/                API contract, deployment, WhatsApp setup, security, compliance, billing
```

- **Backend:** Supabase (Postgres + Auth + Edge Functions), project
  `clinibot` in Frankfurt.
- **AI:** Anthropic Claude (`claude-opus-5-5` by default) called only from Edge
  Functions; the key never reaches the browser.
- **WhatsApp:** Meta WhatsApp Business Platform Cloud API (Graph API v26.0).

## Documentation

| Document | Contents |
| --- | --- |
| [docs/API.md](docs/API.md) | Every server endpoint, request/response and error codes |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Supabase, secrets, functions, web hosting, post-deploy checks |
| [docs/WHATSAPP-SETUP.md](docs/WHATSAPP-SETUP.md) | Meta checklist and connecting a clinic's number |
| [docs/SECURITY.md](docs/SECURITY.md) | Trust boundaries, controls, key rotation, known limitations |
| [docs/SAUDI-COMPLIANCE.md](docs/SAUDI-COMPLIANCE.md) | PDPL, health, NCA, commercial requirements to verify |
| [docs/BILLING.md](docs/BILLING.md) | Plans, entitlements, enabling payments |
| [docs/STATUS.md](docs/STATUS.md) | Stage-by-stage report: working, not working, missing |

## Running the checks

```bash
# database (needs a local PostgreSQL 15+ superuser)
bash supabase/tests/db/run.sh

# edge functions (Deno 2.9)
cd supabase/functions && deno check */index.ts && deno lint && deno test --allow-env --allow-read

# web app
cd web && npm ci && npm run typecheck && npm run lint && npm test && npm run build
```

CI runs all three on every push that touches `clinibot/`
(`.github/workflows/clinibot.yml`).
