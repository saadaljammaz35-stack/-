# Data Retention Policy

Retention periods are set by the obligations that apply to the licensed partner
NABD operates under, and are populated here at the point those obligations are
confirmed. The engineering positions below are fixed regardless.

| Data                           | Retention                                    | Deletion                                              |
| ------------------------------ | -------------------------------------------- | ----------------------------------------------------- |
| Ledger journals and entries    | Per financial-record obligation              | **Never deleted.** Append-only, enforced by trigger   |
| Audit logs                     | Per obligation                               | **Never deleted.** Append-only, enforced by trigger   |
| Transactions                   | Per obligation                               | Never; PII fields redacted on a valid erasure request |
| KYC applications and documents | Defined period after the relationship ends   | Scheduled purge job, erasure audited                  |
| Customer profile               | Life of the relationship + obligation period | Soft delete, then field-level redaction               |
| Sessions and refresh tokens    | 90 days after expiry                         | Hard delete                                           |
| Security events                | 2 years                                      | Hard delete                                           |
| Notifications                  | 12 months                                    | Hard delete                                           |
| Idempotency keys               | 24 hours                                     | Hard delete                                           |
| Webhook events                 | 90 days (dead-letter: until resolved)        | Hard delete                                           |
| Application logs               | 90 days hot, then archive                    | Per archive policy                                    |

## Erasure requests

A customer's right to erasure does not override a legal obligation to retain
financial records. The reconciliation is:

- **Ledger entries and audit logs are retained.** They are the record of a
  transaction that legally occurred.
- **Identifying fields are redacted** in the customer profile and in transaction
  descriptions.
- **KYC documents are deleted** once the retention obligation has run.
- The customer is told plainly which data was erased and which was retained, and
  why — not given a blanket "done".

Every erasure is itself recorded in the audit log: who requested it, who
executed it, when, and exactly what was redacted.
