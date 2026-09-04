# NABD — Running it on your machine

> **Read this first.** The financial core in `packages/` has been built and
> tested (286 unit tests, 32 database invariant tests). The `apps/` — the API,
> the mobile app, the web and admin front ends — depend on NestJS, Prisma and
> Expo, which could not be installed in the environment where this code was
> written. **Their code has not been run.** This guide is how you run it, and
> what to expect when you do.

---

## 1. What you need

| Tool    | Version     | Check           |
| ------- | ----------- | --------------- |
| Node.js | 22 or newer | `node -v`       |
| pnpm    | 10 or newer | `pnpm -v`       |
| Docker  | any recent  | `docker -v`     |
| Git     | any recent  | `git --version` |

If you do not have pnpm:

```bash
corepack enable
corepack prepare pnpm@10.33.0 --activate
```

---

## 2. Get the code running

```bash
git clone <your-repo-url> nabd
cd nabd
git checkout claude/nabd-fintech-platform-gwerpm

# Install everything. This is the step that could not run in the build
# environment, so expect it to take a few minutes the first time.
pnpm install
```

### Verify the core before anything else

```bash
pnpm typecheck   # strict TypeScript across every package
pnpm lint
pnpm test        # 286 unit tests
```

All three should pass. If they do, the financial core is sound on your
machine — that is the part that decides where money goes.

---

## 3. Start the infrastructure

```bash
cp .env.example .env
docker compose up -d
```

That starts PostgreSQL, Redis and MinIO. Wait for the health checks:

```bash
docker compose ps
```

### Apply the schema and prove it holds

```bash
pnpm db:migrate
pnpm db:verify
```

`db:verify` is worth watching. It builds a scratch database and then **tries to
break the ledger as a superuser** — unbalanced journals, direct `UPDATE`s on
posted entries, deleting audit logs, a double spend. Every one must be refused
by PostgreSQL itself. You should see:

```
Database invariants: 32 passed, 0 failed
```

### Load development data

```bash
pnpm db:seed
```

This creates a demo customer with a balance of **12,850.75 SAR** and 20
transactions — all posted as real journals, then verified: the seed asserts its
own totals and fails loudly if they drift.

> `db:seed` refuses to run when `NODE_ENV=production`, when
> `ENABLE_SEED_DATA` is not `true`, or when `DATABASE_URL` looks like a
> production host.

---

## 4. Run the API

```bash
pnpm --filter @nabd/api prisma:generate
pnpm --filter @nabd/api start:dev
```

Then check it is alive:

```bash
curl http://localhost:3000/live
curl http://localhost:3000/health
```

`/health` reports ledger integrity. `ledger.status` must be `"ok"`. If it ever
says `INTEGRITY_VIOLATION`, stop and read
[DISASTER-RECOVERY.md](./DISASTER-RECOVERY.md) — it means the balance cache has
drifted from the entries, which is a page-at-any-hour condition.

Interactive API documentation: **http://localhost:3000/docs**

### Expect to fix things here

This is the code that has not been executed. When something fails, it will
almost certainly be one of these, in order of likelihood:

| Symptom                               | Cause                                      | Fix                                                        |
| ------------------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `Cannot find module '@prisma/client'` | Client not generated                       | `pnpm --filter @nabd/api prisma:generate`                  |
| `Cannot find module '@nabd/...'`      | Workspace packages not built               | `pnpm build`                                               |
| A Nest decorator or DI error at boot  | A missing `@Module` wiring or provider     | Add the controller/service to `apps/api/src/app.module.ts` |
| `ConfigurationError` on start         | A required variable is missing from `.env` | The message names the variable                             |
| Prisma "table does not exist"         | Migration not applied                      | `pnpm db:migrate`                                          |

None of these touch the ledger logic — they are wiring. The domain packages are
already proven by the test suite.

---

## 5. Run the mobile app

```bash
pnpm --filter @nabd/mobile start
```

Press `i` for the iOS simulator, `a` for Android, or scan the QR code with the
Expo Go app on a physical device.

The app opens **in Arabic with RTL layout**. Direction is applied at startup
before the first render — React Native needs a reload for `forceRTL` to take
effect, and flipping it later leaves the layout half-mirrored, which in a
banking app means amounts and their signs end up on the wrong side.

---

## 6. What is actually finished

| Area                            | State                                  | Proven by                                                                                                 |
| ------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Money arithmetic                | **Done**                               | 48 tests: rounding, splitting, FX, precision beyond `Number.MAX_SAFE_INTEGER`                             |
| Double-entry ledger             | **Done**                               | 58 tests: double spend under 20-way contention, idempotency races, deadlock-free locking, holds, reversal |
| Card authorisation & settlement | **Done**                               | 28 tests: over/under settlement, expiry, refunds, redelivered settlement files                            |
| Wallet tiers & limits           | **Done**                               | 20 tests: window accumulation, structuring, boundaries                                                    |
| Authentication                  | **Done**                               | 33 tests: JWT attacks, refresh rotation with reuse detection, OTP caps                                    |
| Security controls               | **Done**                               | 24 tests: sliding-window limits, lockout, redaction, fraud scoring                                        |
| QR payments                     | **Done**                               | 29 tests: EMVCo round-trip, Arabic names, checksum rejection                                              |
| KYC workflow                    | **Done**                               | 25 tests: state machine, document rules, expiry                                                           |
| Admin RBAC                      | **Done**                               | 21 tests: separation of duties, the absolute denials                                                      |
| Provider adapters               | **Done**                               | 17 tests: retries, circuit breaker, webhook signatures                                                    |
| Database schema                 | **Done**                               | 32 invariant tests against real PostgreSQL                                                                |
| API endpoints                   | **Written, not run**                   | —                                                                                                         |
| Mobile screens                  | **Home + Send money written, not run** | —                                                                                                         |
| Web / admin front ends          | **Scaffolded only**                    | —                                                                                                         |

---

## 7. Before this touches real money

None of the following is an engineering task, and every one of them blocks
launch. See [COMPLIANCE.md](./COMPLIANCE.md).

1. An **EMI licence**, or a written agency arrangement with a licensed entity
2. A contract with a **licensed payment provider or bank**
3. An **AML/CFT programme** with an appointed officer
4. **Real** sanctions and PEP screening — the mock adapters are workflow stubs
   and must never be relied on as screening
5. An independent penetration test
6. Legally reviewed terms and privacy policy

The application **refuses to start** in production with a mock provider, a
development signing key, seed data enabled, a localhost database, or wildcard
CORS. That check is in `apps/api/src/config/configuration.ts` and exists so a
misconfigured deploy fails loudly instead of quietly accepting real money into
a simulator.

---

## 8. Useful commands

```bash
pnpm verify         # typecheck + lint + tests + database invariants
pnpm test           # unit tests only
pnpm db:verify      # try to break the ledger as a superuser
pnpm format         # apply formatting
pnpm build          # build all packages

docker compose logs -f postgres
docker compose down -v      # reset the database completely
```

## 9. Where to read next

- [README.md](./README.md) — what this is and the one rule that shapes it
- [ARCHITECTURE.md](./ARCHITECTURE.md) — system design and the transfer data flow
- [DATABASE.md](./DATABASE.md) — schema, triggers, reconciliation
- [SECURITY.md](./SECURITY.md) — controls, and what is never stored
- [COMPLIANCE.md](./COMPLIANCE.md) — the licensing model and the honest limits
