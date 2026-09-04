# NABD — Architecture

> **NABD is not a licensed bank.** NABD is a FinTech technology platform. It holds no
> banking licence, issues no legal tender, and moves no real money on its own. Every
> movement of real value is delegated to a **licensed financial institution or payment
> service provider** through a replaceable adapter. See [COMPLIANCE.md](./COMPLIANCE.md).

---

## 1. Design principles

| #   | Principle                                         | Consequence in the code                                                                                                                                   |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **The ledger is the truth**                       | No `balance = balance - amount` anywhere. Balances are _derived_ from immutable double-entry postings.                                                    |
| 2   | **Money is never a float**                        | All amounts are `bigint` **minor units** (halalas, cents). `Money` is a value object; the `number` type is forbidden for amounts.                         |
| 3   | **Financial history is append-only**              | `journals` and `ledger_entries` are immutable, enforced by database triggers — not by convention. Corrections are _reversal journals_.                    |
| 4   | **Every external financial system is an adapter** | `PaymentProvider`, `BankingProvider`, `CardProvider`, `KycProvider`, `SanctionsProvider`. A `Mock*` implementation ships; a real one is dropped in later. |
| 5   | **Everything financial is idempotent**            | Every value-moving command carries an `Idempotency-Key`. Replays return the original result, never a second posting.                                      |
| 6   | **Least privilege, always**                       | RBAC on the admin plane, row-scoping on the customer plane, and separate credentials per environment.                                                     |
| 7   | **Assume breach**                                 | Secrets out of the repo, PII encrypted at rest, audit logs immutable and append-only.                                                                     |

---

## 2. System context

```
                    ┌──────────────────────────────────────────────┐
                    │                  CLIENTS                     │
                    │                                              │
   iOS / Android ──►│  apps/mobile   (React Native + Expo, RTL)    │
   Browser       ──►│  apps/web      (Next.js, customer)           │
   Staff browser ──►│  apps/admin    (Next.js, back office, MFA)   │
                    └───────────────────┬──────────────────────────┘
                                        │ HTTPS / REST (+ WSS realtime)
                                        ▼
                    ┌──────────────────────────────────────────────┐
                    │           apps/api  (NestJS, TypeScript)     │
                    │                                              │
                    │  Edge:    rate limit · idempotency · authn    │
                    │           authz · request-id · audit          │
                    │  Domain:  accounts · ledger · transfers ·     │
                    │           payments · cards · beneficiaries ·  │
                    │           kyc · fraud · compliance · support  │
                    └───┬──────────────┬───────────────┬───────────┘
                        │              │               │
             ┌──────────▼───┐   ┌──────▼─────┐  ┌──────▼──────────────┐
             │ PostgreSQL   │   │  Redis     │  │ Object Storage      │
             │ ledger, PII, │   │ cache,     │  │ KYC docs, statements│
             │ audit        │   │ queue,     │  │ (encrypted at rest) │
             │              │   │ rate limit │  │                     │
             └──────────────┘   └──────┬─────┘  └─────────────────────┘
                                       │ jobs
                                ┌──────▼──────────────────────────────┐
                                │  Workers: notifications · webhooks · │
                                │  fraud scoring · statements · recon  │
                                └──────┬──────────────────────────────┘
                                       │  adapter boundary (swappable)
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        ▼              ▼               ▼               ▼              ▼
  PaymentProvider  BankingProvider  CardProvider   KycProvider  SanctionsProvider
   (PSP, licensed)  (bank / BaaS)   (card issuer)  (IDV vendor)  (screening vendor)
```

**Nothing in the domain layer imports a vendor SDK.** The domain depends on the
interface; the adapter depends on the vendor. This is what makes NABD portable
across financial partners.

---

## 3. Monorepo layout

```
apps/
  api/          NestJS REST API, OpenAPI, workers, WebSocket gateway
  mobile/       React Native + Expo. Arabic-first (RTL), English (LTR)
  web/          Next.js customer web
  admin/        Next.js back office — separate auth realm, mandatory MFA

packages/
  shared/       Money, Currency, ids, errors, Result, Clock  — zero deps
  ledger/       Double-entry engine, chart of accounts, posting rules — zero deps
  auth/         Password/PIN hashing, JWT, OTP, refresh-token rotation — zero deps
  security/     Rate limiting, lockout, device fingerprint, redaction — zero deps
  database/     Prisma schema + SQL migrations + seed
  payments/     PaymentProvider · BankingProvider · CardProvider + mocks
  notifications/Channel abstraction (push/sms/email/in-app) + queue contract
  compliance/   KYC, sanctions, PEP, risk scoring, case management adapters
  ui/           NABD design system: tokens, primitives, RTL/LTR, themes
```

### Dependency rule

```
apps/*        ──► packages/*        (allowed)
packages/*    ──► packages/shared   (allowed)
packages/ledger ──► shared only     (enforced: the engine stays pure)
packages/*    ──► apps/*            (FORBIDDEN)
domain        ──► vendor SDK        (FORBIDDEN — go through an adapter)
```

The five packages marked _zero deps_ have **no third-party dependencies at all**.
They are pure TypeScript compiled by `tsc` and tested by `node:test`. This is
deliberate: the code that decides where money goes has no supply chain.

---

## 4. The ledger (the part that matters)

### 4.1 Chart of accounts

NABD keeps a real chart of accounts. Customer money is a **liability** of the
platform — the customer's balance is money NABD owes them.

| Ledger account            | Type      | Normal balance | Meaning                            |
| ------------------------- | --------- | -------------- | ---------------------------------- |
| `user:<accountId>`        | LIABILITY | CREDIT         | What NABD owes this customer       |
| `system:settlement:<ccy>` | ASSET     | DEBIT          | Funds held at the partner bank/PSP |
| `system:suspense:<ccy>`   | ASSET     | DEBIT          | Unidentified / in-flight funds     |
| `system:fees:<ccy>`       | REVENUE   | CREDIT         | Fee income                         |
| `system:fx:<ccy>`         | REVENUE   | CREDIT         | FX spread income                   |
| `system:payable:<ccy>`    | LIABILITY | CREDIT         | Owed to external parties           |
| `system:writeoff:<ccy>`   | EXPENSE   | DEBIT          | Losses, chargebacks absorbed       |

### 4.2 Posting model

```
Journal (immutable, balanced)
 ├─ LedgerEntry  DEBIT   ledger_account_a   10 000 halalas
 └─ LedgerEntry  CREDIT  ledger_account_b   10 000 halalas

INVARIANT:  Σ debits == Σ credits, per journal, per currency.   [DB trigger]
INVARIANT:  journals and ledger_entries are INSERT-only.        [DB trigger]
INVARIANT:  one journal per idempotency key.                    [UNIQUE index]
INVARIANT:  no journal mixes currencies.                        [DB trigger]
```

A 100.00 SAR transfer from Ali to Sara:

```
Journal  txn_01J...  "P2P transfer"
  DEBIT   user:acc_ali      10000 halalas   (liability down — we owe Ali less)
  CREDIT  user:acc_sara     10000 halalas   (liability up   — we owe Sara more)
```

The platform's total liability is unchanged, which is correct: no money entered
or left NABD, it moved between two customers.

### 4.3 Balances are derived, never assigned

```
posted balance = Σ(credits) − Σ(debits)     for a CREDIT-normal account
posted balance = Σ(debits)  − Σ(credits)    for a DEBIT-normal account

ledgerBalance    = posted balance
availableBalance = ledgerBalance − Σ(active holds)
```

`ledger_account_balances` is a **cache row** carrying `posted_debit_minor`,
`posted_credit_minor` and a `version` column. It is updated inside the same
database transaction as the entries it summarises, under `SELECT … FOR UPDATE`.
A reconciliation job re-derives it from `ledger_entries` and alarms on any drift.
The cache is an optimisation; `ledger_entries` remains the source of truth.

### 4.4 Corrections

A posted journal is never edited or deleted. A correction is a new journal with
`reversal_of_journal_id` set, carrying the mirror-image entries. The original
stays visible forever. This is what makes the ledger auditable.

---

## 5. Data flow — customer-to-customer transfer

This is the critical path. Every guard exists because of a specific failure mode.

```
 1  POST /v1/transfers          Idempotency-Key: 8f2c…   Authorization: Bearer …
      │
 2  ├─ EDGE: rate limit (per user + per IP) ────────────► 429 if exceeded
      │
 3  ├─ AUTHN: verify access token, session alive, device known
      │
 4  ├─ IDEMPOTENCY: SELECT … WHERE key = 8f2c
      │     ├─ found + COMPLETED ──────────────────────► 200 replay original response
      │     ├─ found + IN_FLIGHT ──────────────────────► 409 request_in_progress
      │     └─ not found → INSERT (key, IN_FLIGHT)  ◄── UNIQUE index wins the race
      │
 5  ├─ VALIDATE: currency match, amount > 0, limits, self-transfer, account status
      │
 6  ├─ AUTHZ: caller owns the source account
      │
 7  ├─ BENEFICIARY: verified? past cooling period? strong-auth satisfied?
      │
 8  ├─ FRAUD: score 0–100 from amount, velocity, device, IP, beneficiary age
      │     ├─ CRITICAL ───────────────────────────────► BLOCKED  + SecurityEvent
      │     ├─ HIGH ───────────────────────────────────► REVIEW queue, PENDING
      │     └─ LOW/MEDIUM → continue
      │
 9  ├─ COMPLIANCE: sanctions + PEP screening on the counterparty
      │
10  ├─ ┌── DATABASE TRANSACTION ────────────────────────────────────────┐
      │ │ a. lock both balance rows FOR UPDATE, ordered by account id   │  ← deadlock-free
      │ │ b. re-read available balance INSIDE the lock                  │  ← double-spend guard
      │ │ c. if insufficient → ROLLBACK, 422 insufficient_funds         │
      │ │ d. INSERT transaction (PROCESSING)                            │
      │ │ e. INSERT journal + 2 ledger_entries   (Σdr == Σcr trigger)   │
      │ │ f. UPDATE both balance caches, version += 1                   │
      │ │ g. UPDATE transaction → COMPLETED                             │
      │ │ h. INSERT audit_log (append-only)                             │
      │ │ i. INSERT outbox rows (notification, webhook)                 │  ← transactional outbox
      │ └── COMMIT ────────────────────────────────────────────────────┘
      │
11  ├─ IDEMPOTENCY: store response, mark COMPLETED
      │
12  └─ 201 Created  { transactionId, status: COMPLETED, reference }

      ┄┄ asynchronously, after commit ┄┄
      Outbox relay → queue → push/SMS notification, webhook delivery,
                             realtime WS push, analytics projection
```

**Why step 10 is one transaction:** the ledger entries, the balance cache, the
transaction record, the audit log and the outbox rows either all exist or none
do. There is no window in which money has moved but the notification was lost,
or the audit log is missing a posting.

**Why the outbox:** we never call an external system inside the transaction. A
slow SMS gateway must not hold a lock on a customer's balance.

### 5.1 External payment (money leaves NABD)

An external payment cannot be atomic — the outside world is not in our
transaction. So it is a saga with a hold:

```
1  RESERVE   place a HOLD on the customer account   (availableBalance drops,
             ledgerBalance unchanged, nothing posted yet)
2  DISPATCH  PaymentProvider.createPayment(…)  with our reference as the
             provider idempotency key
3  AWAIT     webhook  payment.completed | payment.failed
              ├─ completed → release hold, POST journal:
              │                DEBIT  user:acc      CREDIT system:settlement
              ├─ failed    → release hold, no posting, transaction FAILED
              └─ silence   → reconciliation job polls getPaymentStatus()
                             until terminal; hold expires to a review case
```

The customer's money is never posted out until the provider confirms. The hold
means they cannot spend it twice while it is in flight.

---

## 6. Transaction state machine

Arbitrary transitions are rejected by the engine, not by a code review.

```
                 ┌──────────┐
                 │ INITIATED│
                 └────┬─────┘
             ┌────────┼─────────┐
             ▼        ▼         ▼
       ┌─────────┐ ┌──────┐ ┌──────────┐
       │ PENDING │ │FAILED│ │CANCELLED │   (terminal: FAILED, CANCELLED)
       └────┬────┘ └──────┘ └──────────┘
            ▼
      ┌────────────┐
      │ PROCESSING │──► FAILED / CANCELLED
      └─────┬──────┘
            ▼
      ┌───────────┐
      │ COMPLETED │──► REVERSED       (terminal: REVERSED)
      └───────────┘
```

`COMPLETED → PENDING` is impossible. `REVERSED` is reachable only from
`COMPLETED`, and only by posting a reversal journal.

---

## 7. Security architecture

| Layer        | Control                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Transport    | TLS 1.2+ only, HSTS, certificate pinning on mobile                                                      |
| Edge         | Per-IP and per-user rate limits, progressive lockout, request size caps                                 |
| Authn        | Phone/email + password, PIN, OTP, biometric (device-bound key), MFA for admin                           |
| Tokens       | Short-lived access JWT (15 min); refresh tokens **rotating, hashed at rest, revocable, reuse-detected** |
| Session      | Device binding, revocation, concurrent-session listing, idle + absolute timeout                         |
| Authz        | Customer: row-scoped ownership. Admin: RBAC, 8 roles, least privilege                                   |
| Secrets      | Env vars in dev, `SecretsProvider` abstraction in prod. Never in git                                    |
| Data         | PII encrypted at rest, KYC documents encrypted + access-logged + expiring URLs                          |
| Never stored | Plaintext passwords, plaintext PINs, CVV, full PAN, card secrets                                        |
| Audit        | Append-only, delete-blocked by DB trigger, who/what/when/IP/device/before/after/reason                  |

**Refresh-token reuse detection:** tokens rotate on every use. If a token that has
already been rotated is presented again, the entire session family is revoked and a
`SecurityEvent` is raised — this is the signature of a stolen token.

---

## 8. Reliability

| Concern                | Mechanism                                                               |
| ---------------------- | ----------------------------------------------------------------------- |
| Duplicate requests     | Idempotency keys, `UNIQUE` enforced                                     |
| Double spend           | Row locks + balance re-read inside the transaction                      |
| Deadlocks              | Locks always acquired in sorted account-id order                        |
| Partial failure        | Single DB transaction; transactional outbox for side effects            |
| Slow dependency        | Timeouts + circuit breaker per adapter                                  |
| Transient failure      | Retry with exponential backoff + jitter, capped                         |
| Poison messages        | Dead-letter queue with replay tooling                                   |
| Lost provider callback | Reconciliation poller against `getPaymentStatus()`                      |
| Deploys                | `/health` `/ready` `/live`, graceful shutdown, drain in-flight requests |

---

## 9. Environments

`development` · `staging` · `production` — fully separate configuration, credentials
and data. Production **refuses to boot** if it detects development secrets, a mock
provider, or seed data enabled. That check is a startup assertion, not a wiki page.

---

## 10. Build order

| Phase | Scope                                               | State                             |
| ----- | --------------------------------------------------- | --------------------------------- |
| 1     | Architecture · monorepo · database · authentication | **this change**                   |
| 2     | Accounts · ledger · transactions                    | **this change** (engine + schema) |
| 3     | Transfers · beneficiaries · notifications           | next                              |
| 4     | Cards · payments · QR                               | next                              |
| 5     | KYC · compliance · fraud                            | next                              |
| 6     | Admin · support · audit                             | next                              |
| 7     | Production infra · security · monitoring · testing  | next                              |
| 8     | Real provider integrations                          | on licence + contract             |
