# Access Control Matrix

`R` read · `W` create/update · `X` execute · `—` no access

## Customer plane

A customer has `R`/`W` on **their own** records only. Enforced by row-scoped
queries, not by a filter applied after the fact.

## Admin plane

| Resource                  | SUPER_ADMIN | ADMIN | COMPLIANCE | RISK  | SUPPORT | OPERATIONS | FINANCE | AUDITOR |
| ------------------------- | ----------- | ----- | ---------- | ----- | ------- | ---------- | ------- | ------- |
| Users (read)              | R           | R     | R          | R     | R       | R          | R       | R       |
| Users (suspend)           | W           | W     | W          | W     | —       | —          | —       | —       |
| Account balances          | R           | R     | R          | R     | R       | R          | R       | R       |
| **Move money**            | —           | —     | —          | —     | **—**   | —          | —       | —       |
| **Post an adjustment**    | —           | —     | —          | —     | —       | —          | **X**   | —       |
| **Reverse a transaction** | —           | —     | —          | —     | —       | —          | **X**   | —       |
| Ledger entries            | R           | R     | R          | R     | R       | R          | R       | R       |
| **Edit a ledger entry**   | **—**       | **—** | **—**      | **—** | **—**   | **—**      | **—**   | **—**   |
| KYC decisions             | R           | R     | X          | R     | R       | —          | —       | R       |
| KYC documents             | —           | —     | R          | —     | —       | —          | —       | R       |
| Fraud cases               | R           | R     | R          | X     | R       | —          | —       | R       |
| Compliance cases          | R           | R     | X          | R     | —       | —          | —       | R       |
| Support tickets           | R           | R     | R          | R     | X       | R          | —       | R       |
| Admin users               | X           | R     | —          | —     | —       | —          | —       | R       |
| Role assignment           | X           | —     | —          | —     | —       | —          | —       | R       |
| Audit logs (read)         | R           | R     | R          | R     | —       | R          | R       | R       |
| **Audit logs (alter)**    | **—**       | **—** | **—**      | **—** | **—**   | **—**      | **—**   | **—**   |
| System configuration      | X           | R     | —          | —     | —       | R          | —       | R       |

## The rows that matter

**No role can move customer money.** Not `SUPER_ADMIN`, not `ADMIN`. Value moves
only through a customer-authenticated request, or through an audited `FINANCE`
adjustment or reversal that requires a named operator and a written reason.

**No role can edit or delete a ledger entry or an audit log.** This is enforced
by database triggers, not by this table — a compromised application cannot grant
itself the ability.

**`SUPPORT` deliberately has no money-movement permission at any level.** Support
agents are the most numerous, most targeted by social engineering, and least
individually vetted population with system access.

**`AUDITOR` is read-only everywhere, including audit logs**, so an audit can be
performed without granting the ability to change anything.

## Requirements

- MFA is mandatory for every admin role.
- Every admin action is written to the append-only audit log with actor, IP,
  device, before/after and reason.
- Access is reviewed quarterly; access is removed within 24 hours of a role
  change or departure.
