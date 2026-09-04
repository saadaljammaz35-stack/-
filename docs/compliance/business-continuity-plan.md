# Business Continuity Plan

## Critical functions, in priority order

| #   | Function                        | Max tolerable outage | Degraded mode                                              |
| --- | ------------------------------- | -------------------- | ---------------------------------------------------------- |
| 1   | Ledger integrity                | **Zero**             | None. If integrity is in doubt, writes stop.               |
| 2   | Customers can see their balance | 1 hour               | Read-only from a replica                                   |
| 3   | Customers can transfer          | 4 hours              | Queue and process on recovery, with clear "pending" status |
| 4   | Authentication                  | 1 hour               | None — cannot be degraded safely                           |
| 5   | Card transactions               | 4 hours              | Issuer's stand-in processing per contract                  |
| 6   | Customer support                | 8 hours              | Alternate channel                                          |
| 7   | KYC onboarding                  | 24 hours             | Queue applications                                         |
| 8   | Reporting and analytics         | 72 hours             | Defer                                                      |

Function 1 is unlike the others. Every other function may be degraded to keep
the platform partly usable. Ledger integrity may not: **if the books might be
wrong, the correct action is to stop writing to them**, not to keep serving
customers on data that cannot be trusted.

## Degraded operation

**Read-only mode.** Balances and history are served from a replica; all
money-movement endpoints return a clear, honest error. Customers are told the
service is temporarily read-only, not given a generic failure.

**Queue-and-forward.** Where a downstream partner is down but our ledger is
healthy, transfers are accepted as `PENDING` with a hold placed, so funds are
reserved but not spendable twice, and settled when the partner returns.
Customers see "pending", never a false success.

**What is never degraded:**

- The double-entry invariant
- Idempotency
- Authentication and authorisation
- Audit logging

If any of those cannot be maintained, the correct behaviour is to reject the
request. There is no acceptable version of "temporarily skip the audit log".

## Dependencies

| Dependency         | Impact if lost        | Mitigation                                                              |
| ------------------ | --------------------- | ----------------------------------------------------------------------- |
| PostgreSQL primary | Total                 | Synchronous standby, automatic promotion                                |
| Redis              | Rate limiting, queues | Degrade to conservative in-process limits; queue persists in the outbox |
| Object storage     | KYC uploads           | Queue uploads; existing documents unaffected                            |
| Payment provider   | Outbound payments     | Circuit breaker; queue-and-forward                                      |
| Banking partner    | Funding and payouts   | Contractual SLA; a second partner is the long-term answer               |
| SMS gateway        | OTP delivery          | Secondary gateway; email fallback                                       |
| Cloud region       | Total                 | Standby region                                                          |

## Testing

| Exercise                                | Frequency |
| --------------------------------------- | --------- |
| Database failover                       | Quarterly |
| Backup restore + integrity verification | Monthly   |
| Region failover                         | Annually  |
| Incident response tabletop              | Quarterly |
| Provider outage simulation              | Quarterly |

An untested plan is a document, not a capability. Each exercise records
wall-clock timings against the objectives and files any gap as an owned action.
