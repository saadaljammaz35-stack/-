# NABD — Entity Relationship Diagram

All primary keys are UUID v7 (time-ordered, index-friendly). All money columns are
`BIGINT` minor units plus an ISO-4217 `currency` column. No `FLOAT`, no `MONEY` type.

---

## 1. Identity & access

```
┌────────────────────┐
│ User               │
│ id            PK   │
│ phone         UQ   │──1─────┐
│ email         UQ   │        │
│ passwordHash       │        │  1
│ pinHash            │        │
│ status             │        ├──────< Session ──────< RefreshToken
│ kycStatus          │        │        id PK           id PK
│ mfaEnabled         │        │        userId FK       sessionId FK
│ createdAt          │        │        deviceId FK     tokenHash  UQ
│ deletedAt (soft)   │        │        ip, userAgent   rotatedTo FK (self)
└─────────┬──────────┘        │        expiresAt       usedAt, revokedAt
          │ 1:1               │        revokedAt
          ▼                   │
┌────────────────────┐        ├──────< Device
│ Profile            │        │        id PK, userId FK
│ userId  PK/FK      │        │        fingerprint UQ(userId,fingerprint)
│ firstName/lastName │        │        platform, model, trusted
│ locale (ar|en)     │        │        lastSeenAt
│ nationalIdEnc      │        │
│ dateOfBirth        │        └──────< SecurityEvent
│ addressEnc         │                 id PK, userId FK
└────────────────────┘                 type, severity, ip, deviceId
                                       metadata JSONB, createdAt
```

`nationalIdEnc`, `addressEnc` are application-encrypted (envelope encryption).
`passwordHash` and `pinHash` are scrypt with a per-record salt. `tokenHash` is
SHA-256 — the raw refresh token never touches the database.

---

## 2. Accounts & the ledger — the core

```
┌──────────────────────┐
│ Account              │  the customer-facing product account
│ id             PK    │
│ userId         FK    │
│ type   PERSONAL|BUSINESS|WALLET|SETTLEMENT|SUSPENSE
│ currency  CHAR(3)    │
│ status ACTIVE|FROZEN|CLOSED|PENDING
│ accountNumber  UQ    │
│ iban           UQ?   │  (only once a licensed partner issues one)
│ createdAt, closedAt  │
└──────────┬───────────┘
           │ 1:1   (a product account maps to exactly one liability ledger account)
           ▼
┌──────────────────────────────┐        ┌───────────────────────────────┐
│ LedgerAccount                │        │ LedgerAccountBalance          │
│ id                PK         │──1:1──►│ ledgerAccountId  PK/FK        │
│ code              UQ         │        │ postedDebitMinor   BIGINT     │
│   user:<accountId>           │        │ postedCreditMinor  BIGINT     │
│   system:settlement:SAR      │        │ holdMinor          BIGINT     │
│ accountId         FK? UQ     │        │ version            BIGINT     │
│ type ASSET|LIABILITY|EQUITY  │        │ updatedAt                     │
│      |REVENUE|EXPENSE        │        └───────────────────────────────┘
│ normalBalance DEBIT|CREDIT   │           cache only — derived from entries,
│ currency  CHAR(3)            │           re-verified by reconciliation
│ isSystem  BOOLEAN            │
└──────────┬───────────────────┘
           │ 1:N
           ▼
┌──────────────────────────────┐        ┌───────────────────────────────┐
│ LedgerEntry     IMMUTABLE    │──N:1──►│ Journal        IMMUTABLE      │
│ id                 PK        │        │ id                PK          │
│ journalId          FK        │        │ reference         UQ          │
│ ledgerAccountId    FK        │        │ idempotencyKey    UQ          │
│ direction  DEBIT|CREDIT      │        │ transactionId     FK?         │
│ amountMinor  BIGINT  > 0     │        │ currency     CHAR(3)          │
│ currency     CHAR(3)         │        │ description                   │
│ sequence     INT             │        │ reversalOfJournalId FK? (self)│
│ createdAt                    │        │ postedAt, createdBy           │
└──────────────────────────────┘        └───────────────────────────────┘
   UPDATE/DELETE blocked by trigger        UPDATE/DELETE blocked by trigger

   ┌──────────────────────────────────────────────────────────────────┐
   │ INVARIANT (deferred constraint trigger, checked at COMMIT):      │
   │   for every journal:  Σ amountMinor WHERE DEBIT                  │
   │                    == Σ amountMinor WHERE CREDIT                 │
   │   and every entry shares the journal's currency                  │
   │   and a journal has at least 2 entries                           │
   └──────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│ Hold                 │  reserves availableBalance without posting
│ id            PK     │
│ ledgerAccountId FK   │
│ amountMinor  BIGINT  │
│ status ACTIVE|RELEASED|CAPTURED|EXPIRED
│ transactionId FK?    │
│ expiresAt            │
└──────────────────────┘
```

**Balance derivation**

```
signed(entry) = +amount  if entry.direction == ledgerAccount.normalBalance
                −amount  otherwise

ledgerBalance    = Σ signed(entry)
availableBalance = ledgerBalance − Σ Hold(status=ACTIVE).amountMinor
```

---

## 3. Movement of value

```
┌────────────────────────────┐
│ Transaction                │  the customer-visible movement
│ id                PK       │
│ type  TRANSFER|PAYMENT|TOPUP|WITHDRAWAL|FEE|REFUND|REVERSAL|CARD_AUTH…
│ status  INITIATED|PENDING|PROCESSING|COMPLETED|FAILED|CANCELLED|REVERSED
│ amountMinor  BIGINT        │
│ currency     CHAR(3)       │
│ senderAccountId    FK?     │
│ receiverAccountId  FK?     │
│ reference          UQ      │
│ idempotencyKey     UQ      │
│ category  FOOD|SHOPPING|TRANSPORT|BILLS|ENTERTAINMENT|OTHER
│ riskScore  INT 0..100      │
│ metadata  JSONB            │
│ failureReason              │
│ createdAt, processedAt     │
└──┬──────────┬──────────┬───┘
   │ 1:0..1   │ 1:0..1   │ 1:N
   ▼          ▼          ▼
┌────────┐ ┌─────────┐ ┌──────────┐
│Transfer│ │ Payment │ │ Journal  │  (posting + any reversal)
│ id  PK │ │ id  PK  │ └──────────┘
│ txnId  │ │ txnId   │
│ benefId│ │ provider│
│ rail   │ │ providerRef UQ
│ note   │ │ method CARD|QR|BILL|WALLET
└────────┘ │ status  │
           └─────────┘

┌────────────────────────────┐        ┌──────────────────────────┐
│ Beneficiary                │        │ Card                     │
│ id            PK           │        │ id              PK       │
│ userId        FK           │        │ userId          FK       │
│ alias, bankName            │        │ accountId       FK       │
│ accountNumberEnc / ibanEnc │        │ providerCardId  UQ       │
│ status PENDING|VERIFIED|   │        │ last4, brand, expMonth/Yr│
│        REJECTED|DISABLED   │        │ type VIRTUAL|PHYSICAL    │
│ verifiedAt                 │        │ status ACTIVE|FROZEN|    │
│ cooldownUntil              │  ◄── cooling period before first use
│ createdAt, deletedAt       │        │   BLOCKED|EXPIRED|CANCELLED
└────────────────────────────┘        │ dailyLimitMinor          │
                                      │ frozenAt                 │
  UNIQUE(userId, ibanEnc) partial     └──────────────────────────┘
  where deletedAt IS NULL              never stores PAN or CVV
```

---

## 4. KYC, compliance, risk

```
┌────────────────────────────┐        ┌────────────────────────────┐
│ KycApplication             │──1:N──►│ KycDocument                │
│ id            PK           │        │ id              PK         │
│ userId        FK           │        │ applicationId   FK         │
│ status NOT_STARTED|PENDING │        │ type ID_FRONT|ID_BACK|     │
│   |UNDER_REVIEW|VERIFIED|  │        │      SELFIE|PROOF_ADDRESS  │
│   REJECTED|EXPIRED         │        │ storageKey  (object store) │
│ provider, providerRef      │        │ encryptionKeyId            │
│ level  BASIC|FULL|ENHANCED │        │ sha256                     │
│ fullName, nationality      │        │ expiresAt, deletedAt       │
│ rejectionReason            │        └────────────────────────────┘
│ submittedAt, reviewedAt    │           bytes live in object storage,
│ expiresAt                  │           encrypted; every read is audited
└────────────────────────────┘

┌──────────────────┐  ┌────────────────────┐  ┌────────────────────┐
│ FraudCase        │  │ ComplianceCase     │  │ AuditLog APPEND-ONLY│
│ id  PK           │  │ id  PK             │  │ id  PK              │
│ userId FK        │  │ userId FK          │  │ actorId, actorType  │
│ transactionId FK?│  │ type SANCTIONS|PEP │  │ action, resourceType│
│ riskScore 0..100 │  │   |AML|SAR|OTHER   │  │ resourceId          │
│ level LOW|MEDIUM │  │ status OPEN|…      │  │ before JSONB        │
│   |HIGH|CRITICAL │  │ severity           │  │ after  JSONB        │
│ signals JSONB    │  │ assignedTo FK?     │  │ reason              │
│ status OPEN|     │  │ providerRef        │  │ ip, deviceId        │
│   REVIEWING|     │  │ resolution         │  │ createdAt           │
│   CONFIRMED|     │  │ openedAt/closedAt  │  └─────────────────────┘
│   DISMISSED      │  └────────────────────┘   UPDATE & DELETE blocked
│ reviewedBy FK?   │                            by database trigger
└──────────────────┘
```

---

## 5. Operations

```
┌───────────────────┐      ┌──────────────────────┐   ┌────────────────────┐
│ Notification      │      │ SupportTicket        │   │ WebhookEvent       │
│ id  PK            │      │ id  PK               │   │ id  PK             │
│ userId FK         │      │ userId FK            │   │ direction IN|OUT   │
│ channel PUSH|SMS| │      │ number  UQ           │   │ provider           │
│   EMAIL|IN_APP    │      │ status OPEN|         │   │ eventType          │
│ event             │      │   IN_PROGRESS|       │   │ externalId  UQ     │
│ title, body       │      │   WAITING_CUSTOMER|  │   │ signatureValid     │
│ status QUEUED|    │      │   RESOLVED|CLOSED    │   │ payload JSONB      │
│   SENT|FAILED|READ│      │ priority, category   │   │ status PENDING|    │
│ attempts          │      │ assignedTo FK?       │   │   PROCESSED|FAILED │
│ sentAt, readAt    │      └──────────┬───────────┘   │   |DEAD_LETTER     │
└───────────────────┘                 │ 1:N           │ attempts, nextRetryAt
                                      ▼               └────────────────────┘
┌───────────────────┐      ┌──────────────────────┐
│ IdempotencyKey    │      │ SupportMessage       │   ┌────────────────────┐
│ key      PK       │      │ id PK, ticketId FK   │   │ OutboxEvent        │
│ userId FK         │      │ authorId, authorType │   │ id PK              │
│ endpoint          │      │ body                 │   │ aggregateType/Id   │
│ requestHash       │      │ attachments JSONB    │   │ eventType          │
│ status IN_FLIGHT| │      │ internal BOOLEAN     │   │ payload JSONB      │
│   COMPLETED|FAILED│      │ createdAt            │   │ publishedAt        │
│ responseStatus    │      └──────────────────────┘   └────────────────────┘
│ responseBody JSONB│                                  written in the same txn
│ createdAt,expiresAt                                  as the money movement
└───────────────────┘

┌───────────────────┐      ┌──────────────────────┐
│ AdminUser         │      │ Consent              │
│ id PK, email UQ   │      │ id PK, userId FK     │
│ passwordHash      │      │ scope, purpose       │
│ role SUPER_ADMIN| │      │ thirdParty           │
│  ADMIN|COMPLIANCE|│      │ status GRANTED|      │
│  RISK|SUPPORT|    │      │   REVOKED|EXPIRED    │
│  OPERATIONS|      │      │ grantedAt, expiresAt │
│  FINANCE|AUDITOR  │      │ revokedAt            │
│ mfaSecretEnc      │      └──────────────────────┘
│ mfaEnabled (req.) │       Open Banking consent —
│ lastLoginIp       │       user can list & revoke
└───────────────────┘
```

---

## 6. Index strategy

| Table            | Index                                                | Why                                         |
| ---------------- | ---------------------------------------------------- | ------------------------------------------- |
| `ledger_entries` | `(ledger_account_id, created_at DESC)`               | statement generation, balance re-derivation |
| `ledger_entries` | `(journal_id)`                                       | balance-invariant trigger                   |
| `journals`       | `UNIQUE(idempotency_key)`                            | the duplicate-posting guard                 |
| `transactions`   | `(sender_account_id, created_at DESC)`               | transaction history                         |
| `transactions`   | `(receiver_account_id, created_at DESC)`             | transaction history                         |
| `transactions`   | `UNIQUE(idempotency_key)`                            | duplicate-request guard                     |
| `transactions`   | `(status, created_at)` partial on non-terminal       | reconciliation sweeps                       |
| `refresh_tokens` | `UNIQUE(token_hash)`                                 | lookup + reuse detection                    |
| `sessions`       | `(user_id, revoked_at)`                              | active-session listing                      |
| `audit_logs`     | `(resource_type, resource_id, created_at DESC)`      | investigations                              |
| `audit_logs`     | `(actor_id, created_at DESC)`                        | staff activity review                       |
| `webhook_events` | `UNIQUE(provider, external_id)`                      | webhook idempotency                         |
| `outbox_events`  | `(published_at) WHERE published_at IS NULL`          | relay poll                                  |
| `beneficiaries`  | `UNIQUE(user_id, iban_enc) WHERE deleted_at IS NULL` | soft-delete-aware uniqueness                |

---

## 7. Retention & deletion

| Data                     | Retention                                  | Deletion                              |
| ------------------------ | ------------------------------------------ | ------------------------------------- |
| Ledger entries, journals | Per financial-record retention obligations | **Never** deleted                     |
| Audit logs               | Per obligation                             | **Never** deleted                     |
| Transactions             | Per obligation                             | Never; PII fields redacted on request |
| KYC documents            | Policy-defined post-relationship           | Purge job + audited erasure           |
| Sessions, refresh tokens | 90 days after expiry                       | Hard delete                           |
| Notifications            | 12 months                                  | Hard delete                           |
| User profile             | Life of relationship                       | Soft delete, then redaction           |

Retention periods are populated from the obligations that apply to the licensed
partner NABD operates under. See `docs/compliance/data-retention-policy.md`.
