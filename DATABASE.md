# NABD — Database

PostgreSQL 16. Prisma for application access; **the checked-in SQL migration is
the source of truth.**

## Why SQL leads and Prisma follows

Three controls cannot be expressed in a Prisma schema, and all three are load
bearing:

1. the **DEFERRED constraint trigger** enforcing debits == credits per journal
2. the **append-only triggers** on `journals`, `ledger_entries`, `audit_logs`
3. the **CHECK constraints** — positive amounts, normal-balance consistency,
   risk-score range, phone format

`prisma db push` against the schema would silently drop them. The workflow is
therefore always `prisma migrate` over the SQL in
`packages/database/migrations/`, and `prisma db push` must never be run against
a shared database.

## Conventions

| Concern      | Choice                                    | Why                                                                                               |
| ------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Primary keys | UUID v7                                   | Time-ordered, so inserts append to the index's right edge instead of scattering across it like v4 |
| Money        | `BIGINT` minor units + `CHAR(3)` currency | No `FLOAT`, no `NUMERIC`, no `MONEY`. `BIGINT` holds ~92 quadrillion halalas                      |
| Timestamps   | `TIMESTAMPTZ`, UTC                        | A naive timestamp in a financial record is ambiguous forever                                      |
| Enums        | Native PG enums                           | Rejects unknown values at the database, not in the ORM                                            |
| Soft delete  | `deleted_at` + partial unique indexes     | A closed account must not block re-registration                                                   |
| JSON         | `JSONB`                                   | Metadata and audit snapshots only — never money                                                   |

## The ledger tables

```
journals              immutable, one per balanced movement, UNIQUE idempotency_key
ledger_entries        immutable, positive amounts, direction carries the sign
ledger_accounts       chart of accounts; normal_balance CHECKed against type
ledger_account_balances   cache: gross debit/credit totals + holds + version
holds                 reserved-but-unposted amounts
```

### The invariant

```sql
CREATE CONSTRAINT TRIGGER ledger_entries_balance_check
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION nabd_assert_journal_balanced();
```

Deferred, so it runs at `COMMIT` once every entry of the journal exists. It
aborts the whole transaction unless debits equal credits, there are at least two
entries, and every entry shares the journal's currency. A journal that mixes
currencies "balances" numerically while being meaningless.

### Immutability

```sql
CREATE TRIGGER ledger_entries_immutable
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION nabd_reject_mutation();
```

Applied to `journals`, `ledger_entries` and `audit_logs`. Verified to hold
against a database superuser — see `tools/db/verify.sh`.

### Reconciliation

Two views make drift detectable rather than invisible:

```sql
SELECT * FROM ledger_reconciliation WHERE drift <> 0;   -- must be empty
SELECT * FROM ledger_trial_balance;                     -- imbalance must be 0
```

`ledger_reconciliation` re-derives every balance from raw entries and shows it
beside the cache. `/health` surfaces both, and a non-zero result is a page: it
means either a write path bypassed the engine, or a cache update and an entry
insert were not in the same transaction.

## Concurrency

The double-spend guard is a row lock plus a re-read _inside_ it:

```sql
SELECT ... FROM ledger_account_balances b
 WHERE b.ledger_account_id = ANY($1::uuid[])
 ORDER BY b.ledger_account_id        -- deterministic order: no deadlocks
   FOR UPDATE OF b;
```

The `ORDER BY` is not decoration. Without it PostgreSQL may lock rows in
whatever order the plan produces, and two concurrent transfers touching the same
pair of accounts can each hold the row the other is waiting for. The engine
always passes ids pre-sorted.

Isolation is `REPEATABLE READ` plus these explicit locks. `SERIALIZABLE` would
also be correct but costs retries under contention that the row locks already
prevent.

## Index strategy

| Table            | Index                                           | Why                                           |
| ---------------- | ----------------------------------------------- | --------------------------------------------- |
| `ledger_entries` | `(ledger_account_id, created_at DESC)`          | Statements, balance re-derivation             |
| `journals`       | `UNIQUE(idempotency_key)`                       | The duplicate-posting guard                   |
| `transactions`   | `UNIQUE(idempotency_key)`                       | The duplicate-request guard                   |
| `transactions`   | `(status, created_at)` partial on non-terminal  | Reconciliation sweeps stay tiny at any volume |
| `refresh_tokens` | `UNIQUE(token_hash)`                            | Lookup and reuse detection                    |
| `audit_logs`     | `(resource_type, resource_id, created_at DESC)` | Investigations                                |
| `webhook_events` | `UNIQUE(provider, external_id)`                 | Webhook idempotency                           |
| `outbox_events`  | `(created_at) WHERE published_at IS NULL`       | Relay poll stays small                        |
| `accounts`       | `UNIQUE(user_id, currency) WHERE is_primary`    | One primary per currency                      |

## Migrations

```bash
pnpm db:migrate     # apply
pnpm db:verify      # rebuild a scratch DB, then try to break it as superuser
pnpm db:seed        # development only — refuses to run in production
```

Rules: migrations are forward-only and never edited once merged; every one is
tested against a copy of production-shaped data; anything that rewrites a large
table is done online with a backfill, never a blocking `ALTER`.

## Backups

Continuous WAL archiving with point-in-time recovery. Targets and the restore
procedure — including the requirement to verify the trial balance after any
restore — are in [DISASTER-RECOVERY.md](./DISASTER-RECOVERY.md).
