# NABD — Disaster Recovery

## Objectives

| Data                       | RPO                                          | RTO      |
| -------------------------- | -------------------------------------------- | -------- |
| Ledger (journals, entries) | **0** — no committed transaction may be lost | 1 hour   |
| Audit logs                 | **0**                                        | 4 hours  |
| Customer and account data  | 5 minutes                                    | 1 hour   |
| KYC documents              | 1 hour                                       | 8 hours  |
| Notifications, analytics   | 1 hour                                       | 24 hours |

A non-zero RPO on the ledger is not acceptable. A lost committed transfer means
a customer's money moved and the platform has no record of it. This is why the
primary runs with a synchronous standby: a commit is not acknowledged until it
is durable in two places.

## Scenarios

### Primary database failure

Promote the synchronous standby. RPO is zero by construction.
**Then verify before resuming writes:** trial balance nets to zero,
reconciliation drift is zero, and the latest journal matches the last known
reference. Resuming writes onto an unverified ledger compounds the incident.

### Data corruption or a bad migration

Point-in-time recovery to just before the event, using continuous WAL archiving.
Identify the exact timestamp from the audit log. Restore to a **separate**
instance first, verify integrity there, then cut over. Never restore in place
over the only copy of the evidence.

### Region failure

Fail over to the standby region: promote the replica, repoint DNS, verify
provider connectivity from the new region, and confirm ledger integrity before
accepting traffic.

### Accidental deletion

Financial records cannot be deleted — the append-only triggers see to that. For
everything else, restore the affected rows from PITR into a scratch database and
copy them back deliberately.

### Provider outage

Circuit breakers open and shed load. In-flight payments stay in a non-terminal
state with a hold in place, so funds are neither lost nor spendable twice. The
reconciliation poller resolves them when the provider returns. Customers see an
honest "pending", not a false success.

## Backups

| What           | Method                                      | Frequency          | Retention            |
| -------------- | ------------------------------------------- | ------------------ | -------------------- |
| PostgreSQL     | Continuous WAL + base backup                | Continuous / daily | Per retention policy |
| Object storage | Cross-region replication + versioning       | Continuous         | Per retention policy |
| Secrets        | Secret-manager backup, separately encrypted | On change          | Per policy           |
| Configuration  | Git                                         | On change          | Indefinite           |

**Backups are encrypted, access-logged, and stored in an account separate from
production** — so a compromise of production does not reach the backups.

## Restore verification

A backup that has never been restored is a hypothesis, not a backup.

Monthly, into an isolated environment:

1. Restore the most recent backup.
2. Assert the trial balance nets to zero for every currency.
3. Assert `ledger_reconciliation` shows zero drift.
4. Spot-check known transactions against their references.
5. Record the wall-clock restore time and compare it to the RTO.
6. File any gap as an action item with an owner.

## Communication

| Audience    | When                                 | Channel                 |
| ----------- | ------------------------------------ | ----------------------- |
| Engineering | Immediately                          | Incident channel + page |
| Leadership  | Within 30 minutes                    | Direct                  |
| Customers   | Within 1 hour if service is affected | In-app + status page    |
| Partners    | If settlement is affected            | Contractual channel     |
| Regulator   | Per notification obligations         | Formal channel          |

Customer communication says what is affected, what is not, and what customers
should do. It never speculates about cause before the facts are established, and
it never claims funds are safe before the ledger has been verified.

## Post-incident

A written review within five business days: timeline, root cause, customer
impact, what worked, what did not, and dated action items with named owners.
Blameless in tone, specific in outcome.
