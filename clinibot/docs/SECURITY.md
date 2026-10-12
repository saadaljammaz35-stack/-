# CliniBot security model

## Trust boundaries

```
 Patient browser ──(session token)──▶ public-chat ─┐
 Meta WhatsApp ──(HMAC signature)───▶ whatsapp-webhook ─┤
 Staff browser ──(user JWT)──▶ Postgres (RLS) │        ├─▶ Postgres (service role, scoped by clinic)
               └─(user JWT)──▶ staff functions ┘        ├─▶ Anthropic API (AI replies)
                                                        └─▶ Meta Graph API (sending)
```

- The **browser** holds only the publishable/anon key and the signed-in
  user's JWT. Everything it reads or writes directly is filtered by Row Level
  Security and column privileges.
- **Edge Functions** use the service role (which bypasses RLS) and are
  therefore responsible for authorisation themselves: every staff function
  verifies the JWT with Supabase Auth and checks membership and role in the
  target clinic before touching data, and every query is scoped by that
  clinic's id.
- **Secrets** (Anthropic key, credentials encryption key, service role key)
  exist only in the Edge Function environment.

## Controls

| Area | Control | Where |
| --- | --- | --- |
| Authentication | Supabase Auth, email confirmation, 10-character minimum, PKCE flow | Auth settings, `web/src/lib/supabase.ts` |
| Tenant isolation | RLS on every table; membership helpers; composite `(id, organization_id)` foreign keys so a child row cannot point into another clinic | `migrations/*_core_schema.sql`, `*_security.sql` |
| Roles | owner / admin / receptionist; owners alone change roles or delete the clinic; a clinic always keeps an owner | RLS policies, `update_member_role`, `remove_member`, triggers |
| Server-owned fields | Column-level grants: the browser cannot set AI-tested flags, WhatsApp status, notification timestamps, subscription state, message rows | `*_security.sql` |
| Business rules in the database | appointment status machine; confirmation requires an agreed time; assistant can only be enabled after a real successful test; seat limits | triggers in `*_security.sql` |
| Integration secrets | AES-256-GCM with a key outside the database; ciphertext bound to its row (AAD); write-only from the UI; verify token stored as SHA-256 | `_shared/crypto.ts`, `integration_credentials` |
| Webhook authenticity | per-clinic unguessable URL key + `X-Hub-Signature-256` HMAC of the raw body + phone number id must match the clinic | `whatsapp-webhook` |
| Duplicate protection | unique WhatsApp message id; receipts only move forward | `ingest_whatsapp_inbound`, `apply_whatsapp_status` |
| Input validation | zod schemas on every function; CHECK constraints in the database | functions, migrations |
| Abuse protection | database-backed rate limits (fail closed), max 3 clinics per account, capped trial AI usage, per-conversation AI limit, honeypot on the demo form | `_shared/ratelimit.ts`, `create_organization`, `org_entitlements` |
| Logging | JSON logs with request ids; message content, names, phones and secrets are redacted by key | `_shared/log.ts` |
| Audit | append-only audit log of who changed what (ids, changed columns, statuses — never personal data); cannot be edited or deleted except by the retention purge | `audit_logs`, `audit_change()` |
| Retention and deletion | per-clinic retention periods, nightly purge, patient self-deletion (web and WhatsApp), staff deletion, clinic deletion | `purge_expired_data`, `public-chat`, pipeline |
| AI safety | no diagnosis or treatment advice; medical questions and emergencies handed to humans; emergency keywords answered without the model; price guard blocks any amount not in the clinic's data; appointments are requests only; knowledge treated as data; customers cannot change the rules | `_shared/assistant/*` |
| Browser hardening | CSP, frame-ancestors none, HSTS, nosniff, strict referrer policy; CORS allowlist on functions | `web/vercel.json`, `web/public/_headers`, `_shared/http.ts` |

The database rules are tested by 129 assertions in
`supabase/tests/db/10_tenant_isolation.sql`, run as the real `anon`,
`authenticated` and `service_role` roles.

## Key rotation

| Secret | How to rotate |
| --- | --- |
| `ANTHROPIC_API_KEY` | create a new key, update the secret, revoke the old key |
| `SUPABASE_SERVICE_ROLE_KEY` | rotate in Supabase (API keys); functions pick it up automatically |
| WhatsApp access token / app secret | the clinic saves new values on the WhatsApp page |
| Webhook verify token | WhatsApp page → regenerate, then update it in the Meta app |
| `CREDENTIALS_ENCRYPTION_KEY` | currently requires every connected clinic to re-save its WhatsApp credentials after the key changes. A dual-key re-encryption job (`key_version` is already stored per row) is planned before the number of clinics makes this impractical. |

## Incident response (outline — complete before launch)

1. Contain: revoke affected keys/tokens, disable affected functions.
2. Assess using function logs (by `request_id`) and `audit_logs`.
3. Where PDPL requires it, notify SDAIA within **72 hours** of becoming aware
   and inform affected clinics/people without undue delay.
4. Record the incident, root cause and fix.

## Known limitations

- Multi-factor authentication is not enforced (Supabase supports TOTP MFA;
  enforcing it for owners/admins is recommended).
- Fixed-window rate limits allow a short burst at window boundaries.
- The patient chat session token lives in the browser's local storage; the
  CSP limits script injection, and the token only grants access to that one
  conversation.
- No independent penetration test has been performed yet.
