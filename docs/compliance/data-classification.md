# Data Classification

Four tiers. The tier determines encryption, access, logging and retention.

| Tier             | Examples                                                                                 | At rest                                                             | In logs                | Access                               |
| ---------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------- | ------------------------------------ |
| **RESTRICTED**   | Passwords, PINs, MFA seeds, refresh tokens, KYC documents, national ID, partner API keys | Hashed or envelope-encrypted; documents in encrypted object storage | **Never**, in any form | Named roles only, every read audited |
| **CONFIDENTIAL** | Balances, transactions, IBANs, beneficiary details, addresses, risk scores               | Encrypted at rest; PII columns application-encrypted                | Masked or last-4 only  | Owner + authorised roles, audited    |
| **INTERNAL**     | Aggregate metrics, non-identifying operational data, system config                       | Encrypted at rest                                                   | Permitted              | Staff                                |
| **PUBLIC**       | Marketing copy, published rates, documentation                                           | —                                                                   | Permitted              | Anyone                               |

## Rules

1. **Default to RESTRICTED** when a field's tier is unclear. Reclassifying down
   is cheap; discovering a leak is not.
2. **RESTRICTED data never enters a log**, including error messages, stack
   traces, analytics events, and support tickets. `@nabd/security`'s `redact()`
   enforces this at the boundary by key _and_ by value pattern.
3. **A tier is inherited by every copy** — a CSV export of transactions is
   CONFIDENTIAL and must be handled as such.
4. **Card data is not classified — it is not held.** Only the last four digits.
5. Any transfer of RESTRICTED or CONFIDENTIAL data outside NABD's systems
   requires a documented lawful basis, a contract, and an audit record.
