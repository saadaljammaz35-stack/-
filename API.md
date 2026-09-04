# NABD — API

Base URL: `https://api.nabd.example/v1` · Interactive docs at `/docs` (non-production).

## Conventions

**Money.** Every amount is an object, never a bare number:

```json
{ "amount": "1285075", "currency": "SAR", "formatted": "12850.75" }
```

`amount` is **minor units as a decimal string**. It is a string because JSON
numbers are IEEE-754 doubles and a large balance would silently lose precision.
Requests take `amountMinor` as an integer; `100.50` is rejected rather than
rounded to something the customer did not ask for.

**Idempotency.** Every `POST`/`PUT`/`PATCH` requires an `Idempotency-Key` header.

```
Idempotency-Key: 8f2c4e1a-...
```

| Situation                     | Response                                  |
| ----------------------------- | ----------------------------------------- |
| First request                 | Processed normally                        |
| Replay, same body             | `200` with the **original** response body |
| Replay, different body        | `409 idempotency_conflict`                |
| Replay while first is running | `409 request_in_progress`                 |

**Errors.** Uniform shape, stable `code` to branch on:

```json
{
  "error": {
    "code": "insufficient_funds",
    "message": "Insufficient funds",
    "category": "BUSINESS_RULE",
    "status": 422,
    "requestId": "req_..."
  }
}
```

| Code                       | Status | Meaning                                                      |
| -------------------------- | ------ | ------------------------------------------------------------ |
| `validation_error`         | 422    | Request failed validation                                    |
| `invalid_amount`           | 422    | Malformed or unrepresentable amount                          |
| `currency_mismatch`        | 422    | Currencies differ                                            |
| `authentication_failed`    | 401    | Deliberately vague — never says which field was wrong        |
| `session_expired`          | 401    | Token or session no longer valid                             |
| `token_reuse_detected`     | 401    | Rotated refresh token replayed; session family revoked       |
| `mfa_required`             | 401    | Second factor needed                                         |
| `forbidden`                | 403    | Authenticated but not permitted                              |
| `strong_auth_required`     | 403    | Step-up needed (amount, or beneficiary cooling period)       |
| `compliance_block`         | 403    | Blocked by risk or screening policy — reason never disclosed |
| `not_found`                | 404    | Missing, or not yours — indistinguishable by design          |
| `idempotency_conflict`     | 409    | Key reused with a different body                             |
| `request_in_progress`      | 409    | Identical request still running                              |
| `concurrency_conflict`     | 409    | Contended write; retryable                                   |
| `insufficient_funds`       | 422    | Available balance too low — balance is not echoed            |
| `limit_exceeded`           | 422    | Transaction or daily limit                                   |
| `account_not_active`       | 422    | Account frozen, closed or pending                            |
| `invalid_state_transition` | 409    | Illegal transaction state change                             |
| `rate_limited`             | 429    | Includes `Retry-After`                                       |
| `provider_error`           | 502    | Downstream partner failed                                    |
| `provider_timeout`         | 504    | Downstream partner timed out                                 |
| `circuit_open`             | 503    | Circuit breaker open; retryable                              |
| `internal_error`           | 500    | Bug. Detail is logged, never returned                        |

## Endpoints

### Health

| Method | Path      | Purpose                                                    |
| ------ | --------- | ---------------------------------------------------------- |
| GET    | `/live`   | Process alive. Checks no dependencies.                     |
| GET    | `/ready`  | Safe to route traffic. Reports `draining` during shutdown. |
| GET    | `/health` | Full diagnostics, including **ledger integrity**.          |

`/health` reports `INTEGRITY_VIOLATION` if the balance cache has drifted from
the entries, or the trial balance does not net to zero. Either is a page.

### Authentication — `/auth`

| Method | Path                 | Purpose                             |
| ------ | -------------------- | ----------------------------------- |
| POST   | `/auth/register`     | Start registration (phone)          |
| POST   | `/auth/verify-phone` | Confirm OTP                         |
| POST   | `/auth/login`        | Phone/email + password → tokens     |
| POST   | `/auth/pin/verify`   | PIN check                           |
| POST   | `/auth/otp/request`  | Issue an OTP for a purpose          |
| POST   | `/auth/otp/verify`   | Verify — single use, attempt-capped |
| POST   | `/auth/refresh`      | **Rotates** the refresh token       |
| POST   | `/auth/logout`       | Revoke the current session          |
| GET    | `/auth/sessions`     | List active sessions and devices    |
| DELETE | `/auth/sessions/:id` | Revoke a session remotely           |

### Accounts — `/accounts`

| Method | Path            | Purpose                     |
| ------ | --------------- | --------------------------- |
| GET    | `/accounts`     | List, with derived balances |
| GET    | `/accounts/:id` | One account                 |

Returns **both** balances, because they differ whenever a hold is active and the
customer can only spend the second:

```json
{
  "ledgerBalance": { "amount": "1285075", "currency": "SAR" },
  "availableBalance": { "amount": "1235075", "currency": "SAR" },
  "heldAmount": { "amount": "50000", "currency": "SAR" }
}
```

### Ledger — `/ledger`

| Method | Path                   | Purpose                                        |
| ------ | ---------------------- | ---------------------------------------------- |
| GET    | `/ledger/entries`      | Raw entries for an account (auditors, support) |
| GET    | `/ledger/journals/:id` | One journal with all its postings              |

Read-only. There is no endpoint that edits or deletes a posting, at any
privilege level. Corrections are reversals, posted through `/admin`.

### Transfers — `/transfers`

| Method | Path             | Purpose                             |
| ------ | ---------------- | ----------------------------------- |
| POST   | `/transfers`     | Create — requires `Idempotency-Key` |
| GET    | `/transfers`     | List                                |
| GET    | `/transfers/:id` | One                                 |

```http
POST /v1/transfers
Authorization: Bearer <token>
Idempotency-Key: 8f2c4e1a-...

{ "senderAccountId": "...", "recipientAccountNumber": "100000000002",
  "amountMinor": 10000, "currency": "SAR", "description": "Lunch" }
```

`201` with `status: "COMPLETED"`, or `status: "PENDING"` when risk scoring sent
it to a review queue — the request is alive and awaiting a human, and nothing
has been posted to the ledger.

### Other resources

`/payments` · `/cards` · `/beneficiaries` · `/kyc` · `/notifications` ·
`/statements` · `/security` · `/support` · `/admin` — all following the same
conventions. `/webhooks/:provider` verifies the signature over the raw body
before parsing, and deduplicates on `(provider, externalId)`.

## Rate limits

| Endpoint class      | Limit                                 |
| ------------------- | ------------------------------------- |
| Login (per account) | 5 / 15 min                            |
| Login (per IP)      | 20 / 15 min                           |
| OTP request         | 5 / hour (plus a 60s resend cooldown) |
| Add beneficiary     | 5 / hour                              |
| Create transfer     | 30 / min                              |
| Reads               | 300 / min                             |

Sliding window, not fixed — a fixed window would let a caller send a full quota
either side of the boundary and double the intended rate.
