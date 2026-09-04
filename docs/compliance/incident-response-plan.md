# Incident Response Plan

## Severity

| Level    | Definition                                                                  | Response             | Page           |
| -------- | --------------------------------------------------------------------------- | -------------------- | -------------- |
| **SEV1** | Customer funds at risk or lost; ledger integrity violated; active breach    | Immediate, all hands | Yes, any hour  |
| **SEV2** | Service unavailable; a security control has failed; data exposure suspected | Within 15 minutes    | Yes            |
| **SEV3** | Degraded service; a control is weakened but holding                         | Within 1 hour        | Business hours |
| **SEV4** | Minor, no customer impact                                                   | Next business day    | No             |

Any non-zero ledger reconciliation drift or trial-balance imbalance is **SEV1 by
definition**, regardless of the amount. A one-halala discrepancy and a
one-million-riyal discrepancy have the same cause: the books are wrong.

## Roles

| Role                    | Responsibility                                        |
| ----------------------- | ----------------------------------------------------- |
| **Incident Commander**  | Owns the response. Decides. Not the person debugging. |
| **Technical Lead**      | Diagnosis and remediation                             |
| **Communications Lead** | Customers, leadership, regulator                      |
| **Scribe**              | Timeline — every action, time-stamped, as it happens  |
| **Compliance Officer**  | Joins any incident touching funds or personal data    |

The Incident Commander does not write code during the incident. Someone must be
watching the whole picture.

## Procedure

**1. Detect and declare.** Anyone may declare. Over-declaring is free;
under-declaring is not. State severity, what is affected, and who is IC.

**2. Contain.** Stop the bleeding before diagnosing it. Revoke sessions, disable
the affected path, open circuit breakers, freeze accounts. **Preserve evidence
while containing** — capture state before restarting anything.

**3. Assess.** What is affected, since when, how many customers, is money
involved, is data exposed, is it ongoing?

**4. Remediate.** Fix forward wherever possible. For a funds incident, verify
ledger integrity _before_ resuming writes — resuming onto an unverified ledger
compounds the incident.

**5. Communicate.** Per the table in [DISASTER-RECOVERY.md](../../DISASTER-RECOVERY.md).
Say what is affected, what is not, and what customers should do. Never speculate
about cause before the facts are established. Never say funds are safe before
the ledger has been verified.

**6. Recover.** Restore normal service. Watch for recurrence. Keep the incident
open until it is genuinely closed.

**7. Review.** Written post-incident review within five business days: timeline,
root cause, impact, what worked, what did not, dated action items with named
owners. Blameless in tone, specific in outcome.

## Funds-specific playbook

If money may have been created, lost, or moved incorrectly:

1. **Do not post correcting entries yet.** Freeze the affected accounts first.
2. Snapshot `ledger_reconciliation` and `ledger_trial_balance` and preserve them.
3. Establish the exact scope from `ledger_entries` — the immutable record is
   authoritative, not the cache.
4. Identify how the invariant was bypassed. If entries exist that should have
   been impossible, the trigger or a write path is broken and **all writes stop**
   until it is understood.
5. Correct only via reversal journals, each with a reason and an operator id.
   Never by editing.
6. Reconcile against the partner's statement.
7. Notify the Compliance Officer, and the regulator if the obligation is met.

## Data breach playbook

1. Contain: revoke credentials, rotate keys, close the vector.
2. Determine exactly what was exposed, for whom, and when.
3. Preserve logs — they are evidence and are shipped off-host precisely so an
   attacker with production access cannot alter them.
4. Notify per the applicable obligation and timeline.
5. Notify affected customers with specifics and concrete guidance.
6. Force credential rotation where authentication material was involved.
