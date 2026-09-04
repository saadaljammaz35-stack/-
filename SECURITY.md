# NABD — Security

## 1. What is never stored

This list is absolute. If any of it appears in the database, a log, an error
message, or an analytics event, that is an incident.

| Never stored                | Why                                                                                       | What is stored instead                                              |
| --------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Plaintext passwords         | A dump becomes a credential-stuffing corpus against every other service the customer uses | scrypt hash with a per-record salt and encoded cost parameters      |
| Plaintext PINs              | Same, and a 4-digit keyspace is trivially reversible                                      | scrypt hash at a raised cost, plus server-side attempt limits       |
| Card PAN                    | Storing it puts NABD in PCI-DSS cardholder-data scope and makes it a target               | Last four digits only; the issuer holds the rest                    |
| CVV / CVC                   | Storing it is prohibited after authorisation, full stop                                   | Nothing                                                             |
| Card secrets, magnetic data | Same                                                                                      | Nothing                                                             |
| Raw refresh tokens          | A read of the token table would let an attacker resume any session                        | SHA-256 of the token                                                |
| OTP codes in the clear      | A database read would yield live codes                                                    | Salted HMAC                                                         |
| MFA seeds in the clear      | Recovers every future code                                                                | Encrypted at rest with an envelope key                              |
| National ID, address        | Direct identity-theft material                                                            | Application-encrypted (`*_enc` columns)                             |
| KYC document bytes          | The single most damaging thing to leak                                                    | Encrypted object storage; only the key reference is in the database |

## 2. Authentication

**Passwords.** scrypt (`N=16384, r=8, p=1`), per-record salt, parameters encoded
in the stored hash so cost can be raised later and old hashes still verify. A
verification against a malformed or missing hash still performs a full
derivation before returning false — returning early makes "no such user"
measurably faster than "wrong password", which is a free enumeration oracle.

**Policy.** Minimum 12 characters. No composition rules that push people toward
`Password1!`. Rejected: repeats, sequences, the service name, and any 6-digit run
of the user's own phone number.

**PINs.** 4 or 6 digits, rejected if all-same, sequential, or in the list of
PINs that account for a large share of real-world choices. The real defence is
the server-side attempt cap — no KDF makes a 4-digit secret strong.

**Access tokens.** JWT, 15-minute lifetime. The verifier refuses `alg: none`,
takes the algorithm from **our** configuration rather than the token's header,
compares signatures in constant time, and validates `exp`, `nbf`, `iss` and
`aud`. Each carries a `jti` so a single token can be revoked.

**Refresh tokens.** Rotating, hashed at rest, revocable, with **reuse
detection**: presenting an already-rotated token revokes the entire session
family and raises a `SecurityEvent`. There are only two causes — a replay of a
stolen token, or a client that lost our response. The first is an account
takeover; the second costs one re-login. Ending the session is right for both.

**Session revocation.** Because access tokens are short-lived but not instantly
revocable on their own, the auth guard also verifies the session row is alive on
every request. Without that, a token stolen minutes before a customer reported
their phone lost would keep working until it expired.

## 3. Authorisation

**Customer plane.** Row-scoped. Queries are bounded to the caller's user id in
the `WHERE` clause, so a bug in a filter cannot leak another customer's data.
Ownership is verified after lookup, and the error is identical whether the
resource is missing or belongs to someone else — so no endpoint can be used to
probe which ids exist.

**Admin plane.** Separate authentication realm, separate token audience,
mandatory MFA, and eight least-privilege roles:

| Role          | May do                                                             |
| ------------- | ------------------------------------------------------------------ |
| `SUPER_ADMIN` | Everything except altering audit logs (nobody can)                 |
| `ADMIN`       | Operational administration                                         |
| `COMPLIANCE`  | KYC decisions, sanctions cases, SAR filing                         |
| `RISK`        | Fraud queue, risk rules, limits                                    |
| `SUPPORT`     | Read customer records, raise tickets — **no money movement**       |
| `OPERATIONS`  | Reconciliation, settlement, suspense clearing                      |
| `FINANCE`     | Adjustments and reversals, always with a reason and an operator id |
| `AUDITOR`     | Read-only across everything, including audit logs                  |

## 4. Application controls

**Rate limiting.** Sliding window, not fixed — a fixed window lets an attacker
send a full quota at `00:59` and another at `01:00`, doubling the intended rate.
Money-moving and credential endpoints are limited far more tightly than reads.

**Lockout.** Exponential backoff after 5 failures, capped at one hour. Not a
permanent lock: a permanent lock hands an attacker a cheap denial of service —
they lock every account they can name.

**Idempotency.** Every value-moving request requires an `Idempotency-Key`. A key
reused with a _different_ body is rejected rather than replayed, because
replaying it would return the wrong answer for the request actually made.

**Log redaction.** Deny-by-key _and_ pattern matching on values, because the
field that leaks a PAN is rarely called `pan` — it is called `data` or
`providerResponse`. Card numbers are Luhn-checked before redaction so a 16-digit
order id is not mangled.

**Webhooks.** Signature verified over the **raw body**, in constant time, before
any parsing. Re-serialising a parsed object changes key order and breaks the
signature. Unsigned webhooks are rejected. Without this, anyone can forge a
`payment.completed` and credit an account.

## 5. Money-safety controls

These sit at the boundary between security and correctness.

- **Double spend.** Balance is re-read _inside_ a `SELECT … FOR UPDATE` row lock,
  never from a cached read. Verified under 20-way concurrency: exactly the
  affordable number of transfers succeed and the balance never goes negative.
- **Deadlocks.** Locks are always acquired in sorted account-id order, so two
  transfers crossing in opposite directions cannot each hold what the other
  wants.
- **Append-only.** `journals`, `ledger_entries` and `audit_logs` reject `UPDATE`
  and `DELETE` via database triggers — verified to hold against a superuser.
- **Never retry a non-idempotent write.** Encoded as a function, not a comment.
  Retrying a `createPayment` without an idempotency key is how a customer gets
  charged twice.
- **Cooling period on new beneficiaries.** The single most effective control
  against account-takeover cash-out.
- **Step-up authentication** above a threshold amount, and for any transfer to a
  beneficiary still inside its cooling period.

## 6. Error handling

Errors carry a stable machine-readable code and a customer-safe message. Detail
goes to `details`, which is logged (redacted) and never serialised to a customer
response. Specifically:

- Authentication failures never reveal whether the identifier or the secret was
  wrong.
- `InsufficientFundsError` does not echo the balance — the customer can read
  their own balance through the accounts endpoint, and echoing it inside a
  failed-payment error makes balance probing trivial for anyone holding a leaked
  token.
- Compliance blocks never tell the subject of a screening hit why they were
  blocked.
- Unrecognised exceptions return a bare 500 with a request id. The stack trace
  goes to the log only.

## 7. Secrets

No API key, password or private key is committed. `.env` is git-ignored;
`.env.example` carries names and shapes only. Production uses a secret manager
behind a `SecretsProvider` abstraction, and the startup assertion described in
the README refuses to boot production with development credentials.

## 8. Reporting a vulnerability

Report privately to the security contact in the internal runbook. Do not open a
public issue. Include reproduction steps and impact; expect acknowledgement
within one business day.
