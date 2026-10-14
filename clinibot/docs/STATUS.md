# CliniBot build status

Last checked: 2026-10-14. Supabase project `clpfcrsoxokhcbrzxgkt` (Frankfurt,
eu-central-1).

This report says what works and how it was checked, what does not work
yet, and what only the owner can do. Nothing is listed as working unless
it was tested.

## ملخص سريع

- **يعمل الآن:** قاعدة البيانات مع عزل كامل بين العيادات، وجميع وظائف الخادم التسع منشورة ومختبرة، ونموذج طلب العرض التجريبي يحفظ فعلاً في قاعدة البيانات، وتطبيق الويب كامل (الموقع التسويقي، لوحة التحكم، المحادثات، المواعيد، الإعدادات، محادثة المرضى) ويجتاز كل الاختبارات.
- **المساعد الذكي:** مفتاح Anthropic أُضيف، والتجربة الحية تحتاج حسابات التجربة.
- **لا يعمل بعد لأنه يحتاج بياناتك:** واتساب (يحتاج حساب Meta للأعمال ومفتاح التشفير).
- **لم يُنشر بعد:** تطبيق الويب نفسه (يحتاج استضافة ونطاق).

## Stage by stage

### 1. Database, tenants and roles: working

- 8 migrations applied to the live project (`core_schema`, `security`,
  three function migrations, function privileges, `retention_schedule`,
  `fk_indexes`).
- Every tenant table has RLS. Column-level grants limit what each role can
  update. Composite `(id, organization_id)` foreign keys stop rows from
  pointing at another clinic's data.
- Roles: owner, admin, receptionist. Triggers enforce the seat limit, the
  last-owner rule, the appointment state machine and the "assistant can be
  switched on only after a passing test" rule.
- Audit log is append-only; changes to clinic data are recorded by triggers.
- **Tested:** 129 SQL assertions in `supabase/tests/db/10_tenant_isolation.sql`
  pass on PostgreSQL 16 (cross-tenant reads and writes, role limits, state
  machine, seat limit, last owner, audit immutability).
- **Security advisor (live):** only expected notices. Three service-only
  tables have RLS on with no policies (`private.rate_limits`,
  `demo_requests`, `integration_credentials`), which means no browser access
  at all. Four `SECURITY DEFINER` RPCs are callable by signed-in users
  (`create_organization`, `list_org_members`, `org_entitlements`,
  `update_member_role`); each checks membership and role itself.
- **Manual SQL step done (2026-10-14):** the owner ran
  `supabase/manual/apply_in_sql_editor.sql`. Checked afterwards:
  `remove_member` and `delete_organization` are callable by signed-in users
  only, `purge_expired_data` by the service role only, the two superseded
  indexes are gone, and the `clinibot-retention-purge` job is active
  (`30 23 * * *`).
- **Not run yet:** `supabase/tests/live/tenant_isolation.live.ts`, which
  repeats the isolation checks through the real API. It needs two confirmed
  test users (see "What only you can do").

### 2. Server functions: deployed, working where configured

All nine Edge Functions are deployed (version 1, status ACTIVE):

| Function             | Sign-in required | Live check                                                                 |
| -------------------- | ---------------- | -------------------------------------------------------------------------- |
| `demo-request`       | no               | 405 on GET, 400 field errors, 400 honeypot, 201 and the row is stored      |
| `public-chat`        | no               | 404 unknown clinic, 400 bad slug, 404 unknown session, 400 bad JSON, 204 CORS preflight, 405 on GET |
| `whatsapp-webhook`   | no (Meta signs)  | 403 failed verification, 404 unknown key on POST, 405 on PUT               |
| `system-status`      | yes              | 401 without a user session                                                 |
| `assistant-test`     | yes              | 401 without a user session, 405 on GET                                     |
| `invite-member`      | yes              | deployed; needs a signed-in owner to test end to end                       |
| `conversation-reply` | yes              | deployed; needs a signed-in member to test end to end                      |
| `whatsapp-connect`   | yes              | deployed; needs the encryption key and a Meta account                      |
| `appointment-notify` | yes              | deployed; needs a confirmed appointment to test end to end                 |

- **Tested:** 280 Deno unit tests; `deno check`, `deno lint` and
  `deno fmt --check` are clean. The deployed bundles were loaded locally and
  answer exactly like the source build.
- **One test row exists:** the `demo-request` smoke test stored one row in
  `demo_requests` (clinic name "E2E TEST - ignore", contact "CliniBot
  deploy check", 2026-10-12). You can delete it from the Table Editor.
- **Secrets:** `ANTHROPIC_API_KEY` was added on 2026-10-14. Not set yet:
  `CREDENTIALS_ENCRYPTION_KEY`,
  `ALLOWED_ORIGINS`, `SITE_URL`, `RATE_LIMIT_SALT`. Without
  `ALLOWED_ORIGINS` the functions only accept browser calls from local
  development addresses, so the deployed web app must have its address added.

### 3. AI assistant: built, not live

- Uses Claude through the server only (`claude-opus-5-5` by default,
  adaptive thinking, low effort, automatic fallback). Answers only from the
  clinic's approved services, prices, hours and FAQs.
- Guards that run on the server, before or after the AI: emergency words in
  Arabic and English get the emergency message and go to staff without
  calling the AI; replies quoting a price that is not in the clinic's data
  are withheld; medical questions are handed to staff; STOP and
  "delete my data" are handled without the AI; per-conversation and
  per-clinic limits.
- **Tested:** with a fake AI client in unit tests (refusals, tool calls,
  price guard, emergencies, handoff, opt-out, quota).
- **Not tested live yet:** `ANTHROPIC_API_KEY` was added on 2026-10-14; the
  first live answer needs a signed-in test owner. Without the key the dashboard shows
  "not configured" with the exact steps, and the database will not let a
  clinic switch the assistant on until a live test in the dashboard passes.

### 4. WhatsApp: built, not connected

- Official WhatsApp Business Platform (Cloud API). Per-clinic webhook URL,
  verify-token handshake, `X-Hub-Signature-256` check on every delivery,
  duplicate delivery protection, delivery statuses, 24-hour window,
  approved templates outside the window, human handoff.
- Credentials are encrypted (AES-256-GCM) before they are stored and are
  never sent back to the browser.
- **Tested:** unit tests with recorded Meta payloads and a fake Graph API;
  the live webhook rejects unknown keys and bad signatures.
- **Not connected:** needs a Meta Business account, a WhatsApp number, a
  permanent access token and app secret, and the `CREDENTIALS_ENCRYPTION_KEY`
  secret. The dashboard shows "not connected" and a setup checklist until
  Meta accepts the credentials and completes the webhook handshake. Steps:
  `docs/WHATSAPP-SETUP.md`.

### 5. Appointments: working (no live data yet)

- Requests come from the AI (web chat or WhatsApp) or are added by staff.
  Status flow: new, contacted, confirmed, cancelled, completed, enforced by
  the database.
- Customers are told an appointment is confirmed only after staff confirm it
  with a time, and only through `appointment-notify`. Changing the time
  clears the "customer notified" mark.
- **Tested:** database state machine (SQL tests), handler and UI tests.

### 6. Web app: built, not deployed

- Arabic first (RTL), English (LTR). Marketing site with an animated SVG
  hero and a demo request form that shows success only after the server has
  stored the request. No invented customers, numbers, testimonials or
  certifications.
- Clinic dashboard: overview from real metrics, conversations inbox with
  staff replies and handoff, appointments, knowledge (services, prices,
  FAQs), assistant settings and test console, WhatsApp setup, staff,
  plan and usage, settings (hours, privacy and retention, delete clinic),
  audit log.
- Patient web chat at `/c/<clinic-link>` with consent first, emergency line,
  delete-my-conversation, and a layout that stays above the iPhone keyboard.
- **Tested:** `npm run typecheck`, `npm run lint`, `npm test`
  (49 files, 597 tests) and `npm run build` all pass.
- **In progress:** an independent multi-reviewer pass (RTL and mobile,
  tenant isolation, API contract, honesty, roles, accessibility) followed by
  Playwright screenshots at 375px and 1280px. Results will be added here.
- **Not deployed:** needs hosting (Vercel or Netlify config is included) and
  a domain. See `docs/DEPLOYMENT.md` section 5.

### 7. Plans and payments: display only

- Starter 299, Growth 699, Pro 1499 SAR per month (excluding VAT), with AI
  reply and seat limits enforced on the server. 14-day trial with 300 AI
  replies.
- No payment provider is connected and the app never asks for card details.
  Plans are changed by recording a subscription in the database
  (`docs/BILLING.md`).

### 8. Privacy and retention

- Consent before web chat; privacy notice on the first WhatsApp message;
  STOP and "delete my data" commands; per-clinic retention with a nightly
  purge; audit log. Details and open points in
  `docs/SAUDI-COMPLIANCE.md`. This is not a legal compliance claim; a
  review by a Saudi data protection specialist is still needed.

## What only you can do

1. ~~Run the manual SQL~~ (done 2026-10-14).
2. **Add Edge Function secrets** (Dashboard → Edge Functions → Secrets):
   - ~~`ANTHROPIC_API_KEY`~~ (added 2026-10-14; live test pending).
   - `CREDENTIALS_ENCRYPTION_KEY`: output of `openssl rand -base64 32`.
     Keep a copy somewhere safe; losing it means reconnecting WhatsApp.
   - `ALLOWED_ORIGINS`: the web app's address, e.g. `https://app.example.sa`.
   - `SITE_URL`: the same address (used in invitation emails).
   - `RATE_LIMIT_SALT`: any long random string.
3. **Authentication settings:** Site URL and redirect URLs for the web app
   address; custom SMTP for emails (Supabase's built-in email sender only
   allows a few emails per hour).
4. **Two test users** for the live isolation test: Authentication → Add user
   → Auto Confirm, `e2e-owner-a@clinibot.test` and
   `e2e-owner-b@clinibot.test`.
5. **Hosting and domain** for the web app.
6. **WhatsApp:** Meta Business account, number and credentials
   (`docs/WHATSAPP-SETUP.md`).

## Known risks and limits

- **Client IP for per-IP limits:** read from `cf-connecting-ip`, then
  `x-real-ip`, then the first `x-forwarded-for`. Which headers the Supabase
  edge sets has not been confirmed; per-session limits still apply.
- **WhatsApp dedup and status SQL** match on the WhatsApp message id across
  all clinics; the webhook checks ownership first. Message ids are globally
  unique, so this is defence in depth only.
- **Two webhook deliveries at the same moment** for a new customer can send
  the privacy notice twice.
- **Emergency word list** can flag non-emergencies (for example "حادث" in an
  insurance question). It errs towards sending the emergency number.
- **Webhook background work** must finish within the Edge Function time
  limit; very long AI turns are cut by a 30-second timeout.
- **Lists** show up to 100 rows and threads the latest 300 messages, with no
  paging yet. Live updates use polling.
