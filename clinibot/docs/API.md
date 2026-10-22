# CliniBot server API

Everything the browser cannot do directly against the database goes through a
Supabase Edge Function. This file is the contract between the functions in
`supabase/functions/` and the web app in `web/`.

Base URL: `https://<project-ref>.supabase.co/functions/v1/<function>`

All functions take and return JSON (`POST`), except the WhatsApp webhook.
Staff functions require `Authorization: Bearer <user access token>`; the
browser gets this automatically through `supabase.functions.invoke`.

## Error format

Every non-2xx response has this body:

```json
{ "error": "machine_code", "message": "Human readable", "details": {}, "request_id": "uuid" }
```

| Status | `error`                                          | Meaning                                                    |
| ------ | ------------------------------------------------ | ---------------------------------------------------------- |
| 400    | `invalid_json`, `invalid_request`                | `details` is `[{ path, message }]` for field errors        |
| 401    | `unauthorized`                                   | Missing/expired session                                    |
| 403    | `forbidden`, `insufficient_role`                 | Not a member of the clinic / role too low                  |
| 404    | `not_found`                                      | Unknown or not-yours resource (same code for both)         |
| 409    | see each function                                | State does not allow the action                            |
| 413    | `payload_too_large`                              |                                                            |
| 429    | `rate_limited`                                   | `details.retry_after_seconds`                              |
| 502    | `upstream_error`                                 | AI or WhatsApp API failed; `details.provider`              |
| 503    | `not_configured`                                 | Server secret missing; `details.variable` names it         |
| 503    | `rate_limit_unavailable`                         | Limiter could not be checked (fail closed)                 |
| 500    | `internal_error`, `database_error`               | Nothing internal is leaked; quote `request_id` to support  |

## Server configuration (Edge Function secrets)

| Variable                      | Required for            | Notes                                                     |
| ----------------------------- | ----------------------- | --------------------------------------------------------- |
| `SUPABASE_URL`                | all                     | Provided by Supabase automatically                        |
| `SUPABASE_SERVICE_ROLE_KEY`   | all                     | Provided by Supabase automatically. Never sent to clients |
| `ALLOWED_ORIGINS`             | browser calls           | Comma-separated, e.g. `https://app.clinibot.sa`           |
| `SITE_URL`                    | invites                 | Public URL of the web app, used in invite links           |
| `ANTHROPIC_API_KEY`           | AI assistant            | Without it the AI reports `not_configured`                |
| `ANTHROPIC_MODEL`             | AI assistant (optional) | Default `claude-opus-5-5`                                 |
| `ANTHROPIC_EFFORT`            | AI assistant (optional) | `low` (default), `medium`, `high`                         |
| `CREDENTIALS_ENCRYPTION_KEY`  | WhatsApp (optional)     | Not needed: the key is generated in the database (Vault). A valid 32-byte base64 value here takes precedence (tests, local development). |
| `WHATSAPP_GRAPH_VERSION`      | WhatsApp (optional)     | Default `v26.0`                                           |
| `RATE_LIMIT_SALT`             | optional                | Salt for hashing client IPs in limiter keys               |

---

## `public-chat` (no sign-in)

The patient-facing web chat at `/c/<clinic-slug>`. Anonymous. Each visitor
holds a random `session_token` (kept in the browser); the server stores only
its SHA-256.

Body: `{ "action": "profile" | "start" | "send" | "poll" | "delete", ... }`

### `profile`

```json
{ "action": "profile", "slug": "clinic-a" }
```

→ `200`

```json
{
  "clinic": {
    "name": "عيادة …", "slug": "clinic-a",
    "assistant_name": "CliniBot",
    "welcome_message": { "ar": "…", "en": "…" },
    "privacy_notice": { "ar": "…", "en": "…" },
    "reception_phone": "+9665…", "emergency_number": "997",
    "default_language": "ar",
    "assistant_available": true
  }
}
```

`404 not_found` when the slug is unknown or the clinic has not turned on
public chat. `assistant_available` is false when the assistant is disabled,
AI is not configured, or the subscription is inactive; the chat still works
and messages reach reception.
Limit: 120 per IP per 10 minutes.

### `start`

```json
{ "action": "start", "slug": "clinic-a", "consent": true, "language": "ar" }
```

`consent` must be literally `true` (privacy notice accepted). →
`200 { "session_token": "…", "messages": [Message] }`. Limit: 10 starts per
IP per hour.

### `send`

```json
{ "action": "send", "session_token": "…", "message": "كم سعر تنظيف الأسنان؟" }
```

`message` 1–1000 chars. → `200 { "messages": [Message], "status": "open" | "awaiting_human" | "closed", "ai_paused": false }`
where `messages` are the new outbound messages produced for this turn (may be
empty when a human has taken over). Limits: 20 per session per 10 minutes,
60 per IP per 10 minutes. `404 not_found` for an unknown token.

### `poll`

```json
{ "action": "poll", "session_token": "…", "after": "2026-10-12T10:00:00Z" }
```

→ `200 { "messages": [Message], "status": "…", "ai_paused": false }` with
every message (both directions) created after `after` (or the last 50).
Limit: 30 per session per minute.

### `delete`

```json
{ "action": "delete", "session_token": "…" }
```

Deletes this visitor's conversation and messages. → `200 { "deleted": true }`.
Limit: 10 per session per 10 minutes.

`Message` = `{ "id", "direction": "inbound"|"outbound", "sender": "customer"|"assistant"|"staff"|"system", "body", "created_at" }`

---

## `assistant-test` (owner, admin)

Runs the real assistant against the clinic's current knowledge without
writing a conversation. A successful run records `ai_last_test_at/ok`, which
is what allows the assistant to be switched on.

```json
{
  "organization_id": "uuid",
  "messages": [{ "role": "user" | "assistant", "content": "…" }]
}
```

`messages`: 1–20 items, last one `user`, each 1–1000 chars. →

```json
{
  "reply": "…",
  "language": "ar",
  "outcome": "answered" | "handoff" | "emergency" | "blocked_price" | "refused",
  "handoff": { "reason": "medical_question", "summary": "…" } | null,
  "appointment_request": { "customer_name": "…", "service_id": "…", "preferred_date": "…", "preferred_time_window": "…", "saved": false } | null,
  "model": "claude-opus-5-5",
  "usage": { "input_tokens": 0, "output_tokens": 0, "cache_read_input_tokens": 0 }
}
```

In test mode tool calls are reported, never executed (`saved: false`).
Errors: `503 not_configured` (`ANTHROPIC_API_KEY`), `502 upstream_error`,
`409 subscription_inactive`, `409 ai_quota_exhausted`, `429`. Limit: 30 per
user per hour.

---

## `system-status` (any member)

```json
{ "organization_id": "uuid" }
```

→

```json
{
  "role": "owner",
  "ai": { "configured": true, "model": "claude-opus-5-5", "enabled": false, "last_test_at": null, "last_test_ok": null },
  "whatsapp": {
    "status": "disconnected" | "credentials_verified" | "connected" | "error",
    "display_phone_number": null, "verified_name": null,
    "credentials_verified_at": null, "webhook_verified_at": null, "last_inbound_at": null,
    "last_error": null,
    "webhook_url": "https://…/functions/v1/whatsapp-webhook/<key>"
  },
  "encryption_configured": true,
  "entitlements": { "plan": "starter", "status": "trialing", "is_active": true, "...": "org_entitlements()" },
  "payments": { "enabled": false, "provider": null }
}
```

`ai.configured` is only whether the key is present; whether it works is
`last_test_ok`. `webhook_url` and `last_error` are omitted for receptionists.

---

## `whatsapp-connect` (owner, admin)

### `save`

```json
{
  "action": "save",
  "organization_id": "uuid",
  "phone_number_id": "1234567890",
  "waba_id": "1234567890",
  "access_token": "EAAG…",
  "app_secret": "…"
}
```

Calls Meta (`GET /<phone_number_id>?fields=display_phone_number,verified_name,quality_rating`)
with the token. Only if Meta accepts it are the credentials encrypted and
stored; then it subscribes the app to the WABA (`POST /<waba_id>/subscribed_apps`).
→ `200`

```json
{
  "status": "credentials_verified",
  "display_phone_number": "+966 …", "verified_name": "…",
  "webhook_url": "https://…/whatsapp-webhook/<key>",
  "verify_token": "shown once, never retrievable again",
  "app_subscribed": true
}
```

Errors: `502 upstream_error` with `details.meta_code`/`details.meta_message`
when Meta rejects the credentials (nothing is stored), `409 phone_number_in_use`
when another clinic has that number, `503 not_configured`
(`CREDENTIALS_ENCRYPTION_KEY`: neither the database key nor a valid environment key could be loaded).

### `rotate_verify_token`

`{ "action": "rotate_verify_token", "organization_id" }` →
`{ "verify_token": "…", "webhook_url": "…" }`. Resets `webhook_verified_at`.
`409 whatsapp_not_connected` when no credentials are stored.

### `test`

`{ "action": "test", "organization_id" }` → re-checks the stored token with
Meta. `{ "ok": true, "display_phone_number", "verified_name", "quality_rating" }`
or `502` and `status = error`. `409 whatsapp_not_connected` when no
credentials are stored.

### `disconnect`

`{ "action": "disconnect", "organization_id" }` → deletes the stored
credentials, frees the phone number mapping, sets `status = disconnected`.
→ `200 { "status": "disconnected" }` (also when nothing was connected).

All `whatsapp-connect` actions share a limit of 10 per user per hour.

Status is `connected` only after **both** Meta accepted the credentials and
Meta completed the webhook verification handshake.

---

## `whatsapp-webhook` (Meta only)

`GET /whatsapp-webhook/<webhook_key>?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`
→ echoes `hub.challenge` (text/plain) when the token matches this clinic's
stored hash; `403 forbidden` otherwise (also for a malformed key or missing
parameters, with no details).

`POST /whatsapp-webhook/<webhook_key>` with `X-Hub-Signature-256: sha256=<hmac>`.
The HMAC-SHA256 of the raw body with the clinic's app secret must match, or
`401`. An unknown or malformed `<webhook_key>` returns `404 not_found`.
Bodies over 1 MB return `413`. Valid requests get `200` immediately; processing continues in the
background:

- Messages for a `phone_number_id` other than the clinic's are ignored.
- Each inbound message is stored once (`wa_message_id` is unique); Meta's
  retries are recognised as duplicates and not answered twice.
- Delivery receipts (`sent`, `delivered`, `read`, `failed`) update the
  outbound message; they never move backwards.
- Replies go out only inside the 24-hour customer service window (always
  true for a reply to a message just received).

---

## `conversation-reply` (any member)

Staff reply from the dashboard.

```json
{ "conversation_id": "uuid", "body": "…", "pause_ai": true }
```

or, outside WhatsApp's 24-hour window, an approved template:

```json
{ "conversation_id": "uuid", "template": { "name": "follow_up", "language": "ar", "body_params": ["…"] } }
```

→ `200 { "message": Message & { "status": "sent" | "failed", "error_code": null } }`

- Web chat: stored; the visitor's page picks it up on the next poll.
- WhatsApp: sent through the Cloud API first; stored with the returned
  `wa_message_id`. Delivery status arrives later through the webhook.
- `409 outside_service_window` when the last customer message is older than
  24 hours and no template was given. `409 whatsapp_not_connected`.
  `409 customer_opted_out` when the customer sent STOP (WhatsApp or web
  chat). `400 invalid_request` when a template is sent on a web chat
  conversation (templates are WhatsApp only).
- Limit: 60 per user per minute.
- `pause_ai` (default `true`) hands the conversation to staff: the assistant
  stops replying until it is turned back on.

---

## `appointment-notify` (any member)

Tells the customer their appointment is confirmed. Only possible after staff
set the request to `confirmed` with an agreed time.

```json
{ "appointment_request_id": "uuid" }
```

→ `200 { "notified_at": "…" | null, "channel": "web" | "whatsapp", "message": Message }`

`notified_at` is `null` when the message was sent but staff changed the
appointment time while it was being sent: the request is then not marked as
notified, so staff can notify again for the new time.

Errors: `409 not_confirmed`, `409 no_channel` (request was logged by hand:
call the customer), `409 template_required` (WhatsApp window closed and no
confirmation template configured), `409 whatsapp_not_connected`,
`409 customer_opted_out`, `502 upstream_error` (with `details.meta_code`,
`details.meta_message`, `details.error_code` and `details.message_id` when
Meta rejected the send). Limit: 30 per user per 10 minutes.

---

## `invite-member` (owner, admin)

```json
{ "organization_id": "uuid", "email": "rana@clinic.sa", "role": "admin" | "receptionist", "full_name": "Rana" }
```

Admins may invite receptionists only. Existing accounts are added directly;
new addresses receive a Supabase invitation email linking to
`SITE_URL/auth/accept-invite`. → `200 { "member_id": "uuid", "invited": true | false }`
(`invited: false` means an existing account was added).

Errors: `409 already_member`, `409 seat_limit`, `429` (20 per user per hour).

---

## `demo-request` (no sign-in)

```json
{
  "clinic_name": "…", "contact_name": "…", "phone": "+9665…",
  "email": "…", "city": "…", "clinic_type": "dental",
  "message": "…", "locale": "ar", "consent": true, "website": ""
}
```

`website` is a honeypot and must be empty. `phone` is normalised to E.164
(Saudi local `05…` → `+9665…`). → `201 { "ok": true, "id": "uuid" }` only
after the row is committed. Limit: 5 per IP per hour.

---

## Direct database access from the browser (RLS-protected)

Reads and simple edits use `supabase-js` directly; RLS and column grants
decide what is allowed (see `supabase/migrations`).

| Table / RPC                       | Browser can                                                             |
| --------------------------------- | ----------------------------------------------------------------------- |
| `organizations`                   | read own; owner/admin update `name, city, phone, default_language`      |
| `clinic_settings`                 | read; owner/admin update all except `ai_last_test_*`                    |
| `clinic_services`, `approved_faqs`| read; owner/admin insert/update/delete                                  |
| `conversations`                   | read; update `status, ai_paused, assigned_to`; owner/admin delete       |
| `messages`                        | read                                                                    |
| `appointment_requests`            | read; insert (by hand); update status/assignee/time; owner/admin delete |
| `appointment_request_notes`       | read; insert                                                            |
| `integration_settings`            | owner/admin read; update template name/language                         |
| `subscription_records`, `ai_usage_monthly`, `audit_logs` | owner/admin read                                 |
| `plan_limits`                     | anyone read (pricing page)                                              |
| `rpc create_organization`         | signed-in user                                                          |
| `rpc list_org_members`, `dashboard_metrics`, `org_entitlements` | members                           |
| `rpc update_member_role`          | owner                                                                   |
| `rpc remove_member`               | owner (anyone), admin (receptionists), self (leave)                     |
| `rpc delete_organization`         | owner, with the clinic slug typed as confirmation                       |
