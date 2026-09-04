# NABD — Threat Model

Method: STRIDE over the data-flow diagram in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Assets, in priority order

1. **Customer funds** — the ledger's integrity and the ability to move value
2. **Authentication material** — passwords, PINs, tokens, MFA seeds
3. **Identity documents and PII** — KYC files, national IDs, addresses
4. **The audit trail** — without it, nothing else can be proven
5. **Partner credentials** — keys to the licensed institutions
6. **Availability** — a payment platform that is down is a failed platform

## Adversaries

| Adversary                      | Capability                             | Primary goal                                     |
| ------------------------------ | -------------------------------------- | ------------------------------------------------ |
| Opportunistic attacker         | Credential stuffing, public exploits   | Cash out any account                             |
| Account-takeover specialist    | Phishing, SIM swap, social engineering | Drain a specific account                         |
| Fraudulent customer            | A legitimate, verified account         | Double spend, chargeback fraud, money laundering |
| Malicious insider              | Staff or admin access                  | Theft, or covering it up                         |
| Compromised dependency         | Code execution inside our process      | Anything                                         |
| Compromised partner            | Forged webhooks, false settlement      | Credit accounts with money that does not exist   |
| Nation-state / organised crime | Persistent, well-resourced             | Large-scale theft or laundering                  |

## STRIDE

### Spoofing

| Threat                                       | Mitigation                                                                                   |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Stolen password                              | scrypt + per-account rate limit + backoff lockout + device binding                           |
| Stolen access token                          | 15-minute lifetime; session revocation checked on **every** request                          |
| Stolen refresh token                         | Rotation + **reuse detection** revokes the whole session family                              |
| Forged JWT (`alg:none`, algorithm confusion) | Algorithm taken from our config, not the token; constant-time verify                         |
| SIM swap defeating SMS OTP                   | OTP is one factor, never sufficient alone for high-value actions; device binding and step-up |
| Forged provider webhook                      | HMAC over the **raw body**, constant-time, before parsing; unsigned rejected                 |

### Tampering

| Threat                                          | Mitigation                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Editing a posted entry                          | Database trigger blocks `UPDATE`/`DELETE` — verified against superuser                    |
| Deleting audit logs to hide theft               | Same trigger on `audit_logs`; no role can bypass it                                       |
| Altering a balance directly                     | Balances are derived; `ledger_reconciliation` detects any drift and `/health` surfaces it |
| Unbalanced journal via raw SQL                  | Deferred constraint trigger aborts the transaction at `COMMIT`                            |
| Modifying an in-flight request body on a replay | Idempotency key binds to a request-body hash; a mismatch is rejected                      |

### Repudiation

| Threat                             | Mitigation                                                               |
| ---------------------------------- | ------------------------------------------------------------------------ |
| "I never made that transfer"       | Immutable journal + audit log with IP, device, request id                |
| "I never approved that adjustment" | Manual adjustments require an operator id and a reason, enforced in code |
| Staff denying an action            | Append-only audit log they cannot alter                                  |

### Information disclosure

| Threat                                   | Mitigation                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Database dump reveals credentials        | Passwords/PINs are scrypt hashes; refresh tokens are SHA-256; OTPs are salted HMAC |
| Database dump reveals identity documents | Documents live in encrypted object storage; only key references in the database    |
| PANs or tokens in logs                   | Redaction by key **and** by value pattern, Luhn-checked                            |
| Account enumeration via login timing     | Full scrypt derivation even when the account does not exist                        |
| Account enumeration via error text       | Authentication errors never say which field was wrong                              |
| Balance probing via a failed payment     | `insufficient_funds` does not echo the balance                                     |
| Resource enumeration via 403 vs 404      | Missing and not-yours are indistinguishable                                        |
| Screening logic disclosure               | Compliance blocks never state the reason to the subject                            |

### Denial of service

| Threat                                  | Mitigation                                                                |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Credential-stuffing floods              | Per-IP and per-account sliding-window limits                              |
| Locking every account by failing logins | Backoff is capped at one hour, never permanent                            |
| One slow provider exhausting the API    | Per-call timeouts + circuit breaker                                       |
| Retry storms after an outage            | Exponential backoff with **full jitter**                                  |
| Lock contention on a hot account        | Locks held only inside one short transaction; no external calls inside it |
| Expensive unbounded queries             | Pagination and partial indexes on the sweep paths                         |

### Elevation of privilege

| Threat                                   | Mitigation                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| Customer accessing another's account     | Row-scoped queries + ownership check                                                  |
| Support agent moving money               | RBAC: `SUPPORT` has no money-movement permission                                      |
| Admin escalating themselves              | Role changes are audited; least privilege; MFA mandatory                              |
| Compromised dependency in the money path | The five packages that decide where money goes have **zero third-party dependencies** |

## Highest-priority risks

### 1. Account takeover → immediate cash-out

The most common way real customers lose money. Layered response: device
binding, new-device and new-country risk signals, a **cooling period on new
beneficiaries**, step-up authentication above a threshold, and fraud scoring
that treats "new payee + new device + drains balance + 3am" as `CRITICAL`.

### 2. Double spend under concurrency

Directly creates money. Row lock with the balance re-read inside it; verified
under 20-way contention at both the engine and SQL layers.

### 3. Forged partner webhook crediting an account

Would credit customers with money that does not exist. Signature verified over
the raw body before parsing; events deduplicated on `(provider, externalId)`;
funding is posted only on confirmed receipt, never on intent.

### 4. Malicious insider

Least privilege, mandatory MFA on the admin plane, an audit log nobody can
alter, and reversals that require a named operator and a reason. Detection
matters as much as prevention: the audit trail is the control.

### 5. Reconciliation drift going unnoticed

If the cache silently diverged from the entries, every displayed balance would
be wrong. Continuous re-derivation, exposed on `/health`, alarmed on non-zero.

## Residual risks — accepted and named

| Risk                                   | Why it remains              | Compensating control                                          |
| -------------------------------------- | --------------------------- | ------------------------------------------------------------- |
| SMS OTP interception                   | SMS is not a secure channel | Never sufficient alone; device binding; step-up               |
| Partner is compromised                 | Outside our control         | Reconciliation against partner statements; limits             |
| Zero-day in a framework dependency     | Unavoidable                 | Money-path packages have no dependencies; rapid patching      |
| Customer's device is compromised       | Outside our control         | Server-side limits, fraud scoring, session revocation         |
| Insider with database superuser access | Ultimate authority          | Append-only triggers, separated duties, off-host log shipping |

## Review

This model is reviewed on every architectural change to authentication, the
ledger, or a provider boundary, and at minimum quarterly.
