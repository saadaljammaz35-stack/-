# NABD — Deployment

## Environments

|           | development     | staging                       | production                    |
| --------- | --------------- | ----------------------------- | ----------------------------- |
| Data      | Synthetic seed  | Anonymised, production-shaped | Real customer data            |
| Providers | Mock            | Partner sandbox               | **Licensed partners only**    |
| Secrets   | `.env`          | Secret manager                | Secret manager, separate keys |
| Seed data | Yes             | No                            | **Refuses to start**          |
| Swagger   | Yes             | Yes                           | Disabled                      |
| Database  | Local container | Managed, isolated             | Managed, HA, PITR             |

Credentials are never shared between environments. A staging key must not work
in production, and a production key must never exist outside it.

## The startup safety assertion

`assertProductionSafety` refuses to boot when `NODE_ENV=production` and any of
the following holds:

- a signing key contains a development marker (`changeme`, `test`, `example`, …)
- a signing key is under 32 characters or a single repeated character
- **any provider is set to a mock implementation**
- `ENABLE_SEED_DATA` is true
- `DATABASE_URL` points at localhost
- `CORS_ORIGINS` is empty or contains a wildcard

Each of these corresponds to a real way fintech deployments have gone wrong.
Failing loudly at boot is strictly better than serving traffic misconfigured.

## Pipeline

```
lint → typecheck → unit tests → database invariant tests
     → integration tests → build → security scan → deploy
```

No stage is skippable. The database invariant stage stands up a real PostgreSQL,
applies the migration, and attempts to break the ledger as a superuser.

## Rolling out

1. **Migrate first, and make it backward compatible.** The old code must keep
   working against the new schema, because both run simultaneously during the
   rollout. Add columns nullable; backfill separately; drop only after the old
   code is gone.
2. **Canary.** One instance, 5% of traffic, watch error rate, latency and
   `/health` ledger integrity.
3. **Progressive rollout** if clean.
4. **Verify:** `/health` reports `ledger.status: "ok"`, reconciliation drift is
   zero, no error-rate regression.

### Graceful shutdown

On `SIGTERM` the process marks itself draining (so `/ready` fails and the load
balancer stops sending traffic), lets in-flight requests and their database
transactions finish, then closes the pool and exits. Tearing the pool down
mid-transaction during a rolling deploy is how a transfer ends up half-recorded.

### Rollback

Code rolls back by redeploying the previous image. **Migrations do not roll
back** — a `DOWN` migration on financial data risks destroying records. Recovery
from a bad migration is forward: a new migration that corrects it. This is why
migrations must be backward compatible in the first place.

## Runtime

- At least 3 API instances across availability zones
- PostgreSQL with a synchronous standby and continuous WAL archiving
- Redis for cache, queue and rate limiting
- Object storage with encryption at rest and versioning
- TLS 1.2+ everywhere; HSTS; certificate pinning on mobile

## Observability

Structured JSON logs (redacted at source), shipped off-host to storage the
application cannot modify. Alerts that page:

| Alert                           | Threshold              |
| ------------------------------- | ---------------------- |
| Ledger reconciliation drift     | **any non-zero value** |
| Trial balance imbalance         | **any non-zero value** |
| 5xx rate                        | > 1% over 5 minutes    |
| Provider circuit open           | any                    |
| Webhook dead-letter queue       | > 0                    |
| Failed-login spike              | > 3× baseline          |
| Stuck non-terminal transactions | age > 15 minutes       |

The first two page unconditionally at any hour. They mean the books may be
wrong, which is the one failure a financial platform cannot sit on.
