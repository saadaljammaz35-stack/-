# Compliance Checklist

Status as of this commit. Engineering items are verifiable from the repository;
the rest are not, and are marked honestly.

## Blocking — no real customer money may be handled until every one is complete

| #   | Item                                                            | Owner       | Status        |
| --- | --------------------------------------------------------------- | ----------- | ------------- |
| 1   | Licence, or a written agency arrangement with a licensed entity | Legal       | ☐ Not started |
| 2   | Executed contract with a licensed PSP / bank                    | Commercial  | ☐ Not started |
| 3   | Regulatory approval for the specific activity                   | Legal       | ☐ Not started |
| 4   | AML/CFT programme, appointed officer, reporting channel         | Compliance  | ☐ Not started |
| 5   | Real sanctions and PEP screening (not mock adapters)            | Compliance  | ☐ Not started |
| 6   | Independent penetration test, findings remediated               | Security    | ☐ Not started |
| 7   | Data-protection assessment and lawful basis                     | Legal / DPO | ☐ Not started |
| 8   | Terms of service and privacy policy, legally reviewed           | Legal       | ☐ Not started |
| 9   | Customer complaints procedure                                   | Operations  | ☐ Not started |
| 10  | Financial audit of ledger and reconciliation                    | Finance     | ☐ Not started |

## Engineering — verifiable from this repository

| #   | Item                                               | Status | Evidence                                              |
| --- | -------------------------------------------------- | ------ | ----------------------------------------------------- |
| 11  | Double-entry ledger, immutable                     | ✅     | `packages/ledger`, DB triggers, `tools/db/verify.sh`  |
| 12  | Balances derived, never assigned                   | ✅     | `ledger_reconciliation` view, zero-drift test         |
| 13  | Audit log, append-only, unalterable by any admin   | ✅     | `audit_logs_immutable` trigger, verified vs superuser |
| 14  | Idempotency on every value-moving path             | ✅     | Engine + API interceptor + unique indexes             |
| 15  | Double-spend prevention under concurrency          | ✅     | 20-way contention test; SQL-level test                |
| 16  | Passwords/PINs hashed, never stored in the clear   | ✅     | `packages/auth`, scrypt                               |
| 17  | Refresh-token rotation with reuse detection        | ✅     | `packages/auth`, tested                               |
| 18  | No PAN or CVV stored anywhere                      | ✅     | Card provider contract; asserted in tests             |
| 19  | PII encrypted at rest                              | ✅     | `*_enc` columns, envelope encryption                  |
| 20  | KYC documents in encrypted storage, access audited | ✅     | Schema; storage key only in DB                        |
| 21  | Log redaction of sensitive values                  | ✅     | `packages/security`, tested incl. PAN in free text    |
| 22  | RBAC, least privilege, MFA on admin                | ✅     | Schema + access-control matrix                        |
| 23  | Consent management with revocation                 | ✅     | `consents` table                                      |
| 24  | Production refuses unsafe configuration            | ✅     | `assertProductionSafety`                              |
| 25  | Every external integration behind an adapter       | ✅     | `packages/payments` contracts                         |
| 26  | Rate limiting and lockout                          | ✅     | `packages/security`, tested                           |
| 27  | Webhook signature verification                     | ✅     | Contract + mock, tested                               |
| 28  | Transactional outbox for side effects              | ✅     | `outbox_events`                                       |
| 29  | Health, readiness, liveness, graceful shutdown     | ✅     | `apps/api`                                            |
| 30  | Reconciliation exposed and alarmed                 | ✅     | `/health`, `ledger_reconciliation`                    |

## Documentation

| #   | Item                         | Status |
| --- | ---------------------------- | ------ |
| 31  | Architecture, ERD, data flow | ✅     |
| 32  | Threat model                 | ✅     |
| 33  | Security controls            | ✅     |
| 34  | Data classification          | ✅     |
| 35  | Data retention policy        | ✅     |
| 36  | Access control matrix        | ✅     |
| 37  | Incident response plan       | ✅     |
| 38  | Business continuity plan     | ✅     |
| 39  | Disaster recovery plan       | ✅     |

## Standing rules

- ☑ No claim that NABD is a bank, anywhere in product, marketing or code
- ☑ No mock provider in production — enforced at startup
- ☑ No seed data in production — enforced at startup
- ☑ No secret committed to the repository
- ☑ No API for a real provider invented in this codebase
