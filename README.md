# NABD | نَبض

**A production-grade FinTech platform.**

> ### ⚠️ NABD is not a bank
>
> NABD holds no banking licence. It is not a deposit-taking institution, it
> issues no legal tender, and it moves no real money on its own. Every movement
> of real value is delegated to a **licensed financial institution or payment
> service provider** through a replaceable adapter.
>
> The product must never be described as "NABD Bank" or «بنك نَبض». It is
> **NABD** or **NABD FinTech Platform**, until and unless the relevant licences
> are obtained. See [COMPLIANCE.md](./COMPLIANCE.md).

---

## What this is

A monorepo containing the software a modern financial platform needs: a real
double-entry ledger, authentication, transfers, cards, KYC, compliance, fraud
scoring, an admin plane, and adapters for the licensed partners that actually
touch money.

It is built to be **connected to a licensed partner**, not to pretend it is one.

## The one rule that shapes everything

```
balance = balance - amount        ← does not appear anywhere in this codebase
```

Balances are **derived** from immutable double-entry postings. Every movement of
value produces a journal whose debits equal its credits, enforced by a database
constraint trigger. A correction is never an edit — it is a reversal journal.

```
Transfer 100.00 SAR from Ali to Sara

Journal NBD-260904-8KF2M3QP
  DEBIT   user:acc_ali    10000 halalas   (liability down — we owe Ali less)
  CREDIT  user:acc_sara   10000 halalas   (liability up   — we owe Sara more)
```

Customer money is a **liability** of the platform. Getting that backwards is the
classic fintech ledger bug — it makes every customer deposit look like revenue.

---

## Repository layout

```
apps/
  api/          NestJS REST API, OpenAPI, workers, WebSocket gateway
  mobile/       React Native + Expo. Arabic-first (RTL), English (LTR)
  web/          Next.js customer web
  admin/        Next.js back office — separate auth realm, mandatory MFA

packages/
  shared/       Money, Currency, ids, errors, Result, Clock      ← zero deps
  ledger/       Double-entry engine, chart of accounts, postings ← zero deps
  auth/         Password/PIN hashing, JWT, OTP, token rotation   ← zero deps
  security/     Rate limiting, lockout, redaction, fraud scoring ← zero deps
  payments/     PaymentProvider · BankingProvider · CardProvider ← zero deps
  database/     Prisma schema + SQL migrations + seed
  notifications/Channel abstraction and queue contract
  compliance/   KYC, sanctions, PEP, case management adapters
  ui/           NABD design system: tokens, themes, RTL/LTR

docs/
  architecture/ ERD, data flow, decision records
  compliance/   Checklist, data classification, retention, IR, BCP, DRP

tools/db/       Migration, fixtures and invariant-verification scripts
```

**The five packages marked `zero deps` have no third-party dependencies at
all.** That is deliberate: the code that decides where money goes has no supply
chain. They compile with `tsc` and test with Node's built-in runner.

---

## Quick start

> **Running it for the first time?** [SETUP.md](./SETUP.md) walks through every
> step, what to expect, and how to fix the things most likely to break.

```bash
# 1. Dependencies
pnpm install

# 2. Configuration — copy and fill in. Never commit .env
cp .env.example .env

# 3. Infrastructure (PostgreSQL + Redis)
docker compose up -d

# 4. Schema. Applies the checked-in SQL, including the ledger triggers.
pnpm db:migrate

# 5. Development seed data — NEVER run this in production
pnpm db:seed

# 6. Run
pnpm --filter @nabd/api start:dev     # http://localhost:3000
pnpm --filter @nabd/mobile start      # Expo
```

API docs are served at `http://localhost:3000/docs` outside production.

## Verification

```bash
pnpm typecheck     # tsc -b, strict, across every package
pnpm lint          # ESLint, including the money-safety rules
pnpm test          # unit + integration tests
pnpm db:verify     # database invariants against a real PostgreSQL
pnpm verify        # all of the above
```

`pnpm db:verify` is the one worth knowing about. It creates a database, applies
the migration, and then **attempts to break the ledger as a superuser** —
unbalanced journals, direct `UPDATE`s on posted entries, deleting audit logs,
double spending. Every attempt must be refused by PostgreSQL itself. A control
that only lives in TypeScript is not a control.

---

## What is verified, and how

| Area             | Coverage                                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Money arithmetic | Parsing, rounding modes, splitting, allocation, FX across exponents, precision beyond `Number.MAX_SAFE_INTEGER`                                                                    |
| Ledger engine    | Balancing, idempotency (sequential and racing), double-spend under 20-way contention, deadlock-free lock ordering, holds, capture, reversal, cache-vs-reconciliation               |
| Authentication   | scrypt round-trip and rehash, JWT `alg:none` and algorithm-confusion rejection, tampering, expiry, refresh-token rotation and **reuse detection**, OTP attempt caps and single use |
| Security         | Sliding-window rate limiting (including the fixed-window boundary burst), lockout backoff caps, log redaction of PANs/JWTs/IBANs, fraud signal explainability                      |
| Providers        | Timeouts, retry with full jitter, circuit breaker half-open probing, webhook signature verification, "never retry a non-idempotent write"                                          |
| Database         | Double-entry trigger, append-only triggers, unique idempotency, CHECK constraints, reconciliation, trial balance, SQL-level double spend                                           |

---

## Architecture

Start with [ARCHITECTURE.md](./ARCHITECTURE.md) — system context, the ledger
model, and the full data flow for a transfer with every guard explained.

- [docs/architecture/erd.md](./docs/architecture/erd.md) — entity relationships and index strategy
- [DATABASE.md](./DATABASE.md) — schema conventions, migrations, reconciliation
- [API.md](./API.md) — endpoints, idempotency, error codes
- [SECURITY.md](./SECURITY.md) — controls and what is never stored
- [THREAT-MODEL.md](./THREAT-MODEL.md) — attackers, assets, mitigations
- [COMPLIANCE.md](./COMPLIANCE.md) — regulatory posture and honest limits
- [DEPLOYMENT.md](./DEPLOYMENT.md) — environments, rollout, rollback
- [DISASTER-RECOVERY.md](./DISASTER-RECOVERY.md) — RPO/RTO and procedures

## Connecting a real financial partner

Nothing in the domain layer imports a vendor SDK. It imports an interface:

```ts
PaymentProvider   createPayment · getPaymentStatus · refundPayment
                  cancelPayment · verifyWebhook
BankingProvider   createAccount · getAccount · getBalance
                  initiateTransfer · getTransfer · getStatement
CardProvider      issueCard · freezeCard · unfreezeCard · terminateCard · setLimits
```

A `Mock*` implementation of each ships in `packages/payments`. When a partner's
specification arrives, write an adapter implementing the same interface and
register it in `apps/api/src/app.module.ts`. **No domain code changes.**

No API for a real provider has been invented anywhere in this repository.

### Production refuses to start unsafely

`assertProductionSafety` fails the boot if `NODE_ENV=production` and any of the
following is true — a mock provider is selected, a signing key contains a
development marker or is under 32 characters, seed data is enabled, the database
points at localhost, or CORS is unset or wildcarded. A misconfigured production
deploy dies loudly instead of quietly accepting real money into a simulator.

---

## Build status

Phases 1 and 2 are implemented and verified. Later phases build on the same
ledger core.

| Phase | Scope                                               | State                            |
| ----- | --------------------------------------------------- | -------------------------------- |
| 1     | Architecture · monorepo · database · authentication | **done**                         |
| 2     | Accounts · ledger · transactions                    | **done**                         |
| 3     | Transfers · beneficiaries · notifications           | API in place, workers next       |
| 4     | Cards · payments · QR                               | adapters in place                |
| 5     | KYC · compliance · fraud                            | schema + scoring in place        |
| 6     | Admin · support · audit                             | schema + audit triggers in place |
| 7     | Production infra · monitoring                       | Docker + CI in place             |
| 8     | Real provider integrations                          | on licence + contract            |

## Licence

UNLICENSED — private and proprietary.
