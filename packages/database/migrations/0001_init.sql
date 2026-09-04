-- ============================================================================
-- NABD — initial schema
--
-- Design notes that matter more than the DDL itself:
--
--  * Money is BIGINT minor units. There is no NUMERIC, no FLOAT, no MONEY.
--  * journals, ledger_entries and audit_logs are append-only. That is enforced
--    by triggers, not by convention, so an ORM bug or a stray UPDATE in a psql
--    session cannot rewrite financial history.
--  * The double-entry invariant is a DEFERRED constraint trigger. It fires at
--    COMMIT, after all of a journal's entries are inserted, and aborts the whole
--    transaction if debits do not equal credits.
--  * Balances live in a cache table updated in the same transaction as the
--    entries. `ledger_reconciliation` re-derives them from entries so drift is
--    detectable rather than invisible.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── enums ───────────────────────────────────────────────────────────────────

CREATE TYPE user_status         AS ENUM ('PENDING','ACTIVE','SUSPENDED','CLOSED');
CREATE TYPE account_type        AS ENUM ('PERSONAL','BUSINESS','WALLET','SETTLEMENT','SUSPENSE');
CREATE TYPE account_status      AS ENUM ('PENDING','ACTIVE','FROZEN','CLOSED');
CREATE TYPE ledger_account_type AS ENUM ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE');
CREATE TYPE entry_direction     AS ENUM ('DEBIT','CREDIT');
CREATE TYPE hold_status         AS ENUM ('ACTIVE','RELEASED','CAPTURED','EXPIRED');
CREATE TYPE transaction_type    AS ENUM (
  'TRANSFER','PAYMENT','TOPUP','WITHDRAWAL','FEE','REFUND','REVERSAL',
  'CARD_AUTHORIZATION','CARD_SETTLEMENT','ADJUSTMENT');
CREATE TYPE transaction_status  AS ENUM (
  'INITIATED','PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED','REVERSED');
CREATE TYPE transaction_category AS ENUM (
  'FOOD','SHOPPING','TRANSPORT','BILLS','ENTERTAINMENT','TRANSFER','INCOME','OTHER');
CREATE TYPE kyc_status          AS ENUM (
  'NOT_STARTED','PENDING','UNDER_REVIEW','VERIFIED','REJECTED','EXPIRED');
CREATE TYPE kyc_level           AS ENUM ('BASIC','FULL','ENHANCED');
CREATE TYPE kyc_document_type   AS ENUM ('ID_FRONT','ID_BACK','SELFIE','PROOF_OF_ADDRESS','OTHER');
CREATE TYPE card_type           AS ENUM ('VIRTUAL','PHYSICAL');
CREATE TYPE card_status         AS ENUM ('PENDING','ACTIVE','FROZEN','BLOCKED','EXPIRED','CANCELLED');
CREATE TYPE beneficiary_status  AS ENUM ('PENDING','VERIFIED','REJECTED','DISABLED');
CREATE TYPE risk_level          AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');
CREATE TYPE case_status         AS ENUM ('OPEN','REVIEWING','CONFIRMED','DISMISSED','ESCALATED','CLOSED');
CREATE TYPE compliance_case_type AS ENUM ('SANCTIONS','PEP','AML','SAR','KYC_REVIEW','OTHER');
CREATE TYPE admin_role          AS ENUM (
  'SUPER_ADMIN','ADMIN','COMPLIANCE','RISK','SUPPORT','OPERATIONS','FINANCE','AUDITOR');
CREATE TYPE notification_channel AS ENUM ('PUSH','SMS','EMAIL','IN_APP');
CREATE TYPE notification_status  AS ENUM ('QUEUED','SENT','DELIVERED','FAILED','READ');
CREATE TYPE ticket_status       AS ENUM ('OPEN','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED');
CREATE TYPE ticket_priority     AS ENUM ('LOW','NORMAL','HIGH','URGENT');
CREATE TYPE idempotency_status  AS ENUM ('IN_FLIGHT','COMPLETED','FAILED');
CREATE TYPE webhook_direction   AS ENUM ('INBOUND','OUTBOUND');
CREATE TYPE webhook_status      AS ENUM ('PENDING','PROCESSED','FAILED','DEAD_LETTER');
CREATE TYPE consent_status      AS ENUM ('GRANTED','REVOKED','EXPIRED');
CREATE TYPE payment_method      AS ENUM ('CARD','QR','BILL','WALLET','BANK_TRANSFER');

-- ── shared helpers ──────────────────────────────────────────────────────────

-- Blocks UPDATE and DELETE outright. Applied to every append-only table.
CREATE OR REPLACE FUNCTION nabd_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'NABD: % on % is forbidden — this table is append-only. Post a reversal instead.',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION nabd_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── identity ────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id              UUID PRIMARY KEY,
  phone           TEXT        NOT NULL,
  email           TEXT,
  password_hash   TEXT,
  pin_hash        TEXT,
  status          user_status NOT NULL DEFAULT 'PENDING',
  kyc_status      kyc_status  NOT NULL DEFAULT 'NOT_STARTED',
  mfa_enabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  phone_verified_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  failed_login_count INT      NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT users_phone_format CHECK (phone ~ '^\+[1-9][0-9]{7,14}$')
);
-- Soft-delete-aware uniqueness: a closed account must not block re-registration.
CREATE UNIQUE INDEX users_phone_key ON users (phone) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX users_email_key ON users (lower(email)) WHERE deleted_at IS NULL AND email IS NOT NULL;
CREATE INDEX users_status_idx ON users (status) WHERE deleted_at IS NULL;
CREATE TRIGGER users_touch BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION nabd_touch_updated_at();

CREATE TABLE profiles (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name      TEXT,
  last_name       TEXT,
  locale          TEXT        NOT NULL DEFAULT 'ar',
  date_of_birth   DATE,
  nationality     TEXT,
  -- Application-encrypted (envelope). Never stored or indexed in the clear.
  national_id_enc BYTEA,
  address_enc     BYTEA,
  encryption_key_id TEXT,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_locale_check CHECK (locale IN ('ar','en'))
);
CREATE TRIGGER profiles_touch BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION nabd_touch_updated_at();

CREATE TABLE devices (
  id            UUID PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint   TEXT NOT NULL,
  platform      TEXT,
  model         TEXT,
  os_version    TEXT,
  app_version   TEXT,
  push_token    TEXT,
  trusted       BOOLEAN NOT NULL DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ,
  UNIQUE (user_id, fingerprint)
);
CREATE INDEX devices_user_idx ON devices (user_id) WHERE revoked_at IS NULL;

CREATE TABLE sessions (
  id            UUID PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id     UUID REFERENCES devices(id) ON DELETE SET NULL,
  ip            INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  revoked_reason TEXT
);
CREATE INDEX sessions_user_active_idx ON sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX sessions_expiry_idx ON sessions (expires_at) WHERE revoked_at IS NULL;

CREATE TABLE refresh_tokens (
  id            UUID PRIMARY KEY,
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- SHA-256 of the token. The raw token never touches the database, so a dump
  -- of this table cannot be replayed against the API.
  token_hash    TEXT NOT NULL UNIQUE,
  -- Set when this token is rotated; presenting a rotated token again is the
  -- signature of theft and revokes the whole session family.
  rotated_to_id UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  used_at       TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_session_idx ON refresh_tokens (session_id);

-- ── product accounts ────────────────────────────────────────────────────────

CREATE TABLE accounts (
  id             UUID PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type           account_type   NOT NULL DEFAULT 'PERSONAL',
  status         account_status NOT NULL DEFAULT 'PENDING',
  currency       CHAR(3)        NOT NULL,
  account_number TEXT           NOT NULL UNIQUE,
  iban           TEXT UNIQUE,
  nickname       TEXT,
  is_primary     BOOLEAN        NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
  closed_at      TIMESTAMPTZ,
  CONSTRAINT accounts_currency_check CHECK (currency ~ '^[A-Z]{3}$')
);
CREATE INDEX accounts_user_idx ON accounts (user_id) WHERE closed_at IS NULL;
-- At most one primary account per user per currency.
CREATE UNIQUE INDEX accounts_one_primary ON accounts (user_id, currency)
  WHERE is_primary AND closed_at IS NULL;
CREATE TRIGGER accounts_touch BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION nabd_touch_updated_at();

-- ── the ledger ──────────────────────────────────────────────────────────────

CREATE TABLE ledger_accounts (
  id            UUID PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  account_id    UUID UNIQUE REFERENCES accounts(id) ON DELETE RESTRICT,
  type          ledger_account_type NOT NULL,
  normal_balance entry_direction    NOT NULL,
  currency      CHAR(3) NOT NULL,
  is_system     BOOLEAN NOT NULL DEFAULT FALSE,
  -- Customer accounts must never go negative; that is the double-spend guard.
  allows_negative_balance BOOLEAN NOT NULL DEFAULT FALSE,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The normal balance must follow from the accounting type. Storing both and
  -- letting them disagree is how a liability silently starts behaving like an
  -- asset.
  CONSTRAINT ledger_accounts_normal_balance_check CHECK (
    (type IN ('ASSET','EXPENSE')             AND normal_balance = 'DEBIT') OR
    (type IN ('LIABILITY','EQUITY','REVENUE') AND normal_balance = 'CREDIT')
  ),
  CONSTRAINT ledger_accounts_system_link CHECK (
    (is_system AND account_id IS NULL) OR (NOT is_system AND account_id IS NOT NULL)
  )
);
CREATE INDEX ledger_accounts_currency_idx ON ledger_accounts (currency);

CREATE TABLE journals (
  id                     UUID PRIMARY KEY,
  reference              TEXT NOT NULL UNIQUE,
  -- The duplicate-posting guard. This index is what makes concurrent retries of
  -- the same request post exactly once.
  idempotency_key        TEXT NOT NULL UNIQUE,
  currency               CHAR(3) NOT NULL,
  description            TEXT NOT NULL,
  transaction_id         UUID,
  reversal_of_journal_id UUID REFERENCES journals(id) ON DELETE RESTRICT,
  created_by             TEXT,
  metadata               JSONB NOT NULL DEFAULT '{}'::jsonb,
  posted_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX journals_transaction_idx ON journals (transaction_id);
CREATE INDEX journals_posted_at_idx ON journals (posted_at DESC);
CREATE INDEX journals_reversal_idx ON journals (reversal_of_journal_id)
  WHERE reversal_of_journal_id IS NOT NULL;

CREATE TABLE ledger_entries (
  id                UUID PRIMARY KEY,
  journal_id        UUID NOT NULL REFERENCES journals(id) ON DELETE RESTRICT,
  ledger_account_id UUID NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
  direction         entry_direction NOT NULL,
  -- Always positive. The direction carries the sign; allowing a negative debit
  -- would make one movement expressible two ways.
  amount_minor      BIGINT NOT NULL,
  currency          CHAR(3) NOT NULL,
  sequence          INT NOT NULL,
  memo              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ledger_entries_amount_positive CHECK (amount_minor > 0),
  UNIQUE (journal_id, sequence)
);
CREATE INDEX ledger_entries_account_time_idx
  ON ledger_entries (ledger_account_id, created_at DESC);
CREATE INDEX ledger_entries_journal_idx ON ledger_entries (journal_id);

-- The balance cache. Authoritative data is in ledger_entries; this table exists
-- so a balance read is O(1) instead of a full scan. Updated inside the same
-- transaction as the entries, under SELECT … FOR UPDATE.
CREATE TABLE ledger_account_balances (
  ledger_account_id  UUID PRIMARY KEY REFERENCES ledger_accounts(id) ON DELETE CASCADE,
  posted_debit_minor  BIGINT NOT NULL DEFAULT 0,
  posted_credit_minor BIGINT NOT NULL DEFAULT 0,
  hold_minor          BIGINT NOT NULL DEFAULT 0,
  version             BIGINT NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT balances_non_negative_totals CHECK (
    posted_debit_minor >= 0 AND posted_credit_minor >= 0 AND hold_minor >= 0
  )
);

CREATE TABLE holds (
  id                UUID PRIMARY KEY,
  ledger_account_id UUID NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
  amount_minor      BIGINT NOT NULL,
  currency          CHAR(3) NOT NULL,
  status            hold_status NOT NULL DEFAULT 'ACTIVE',
  reference         TEXT NOT NULL,
  idempotency_key   TEXT NOT NULL UNIQUE,
  transaction_id    UUID,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ,
  CONSTRAINT holds_amount_positive CHECK (amount_minor > 0)
);
CREATE INDEX holds_active_idx ON holds (ledger_account_id) WHERE status = 'ACTIVE';
CREATE INDEX holds_expiry_idx ON holds (expires_at) WHERE status = 'ACTIVE';

-- ── the double-entry invariant ──────────────────────────────────────────────
--
-- A DEFERRED constraint trigger: it runs at COMMIT, once every entry of the
-- journal has been inserted, and aborts the entire transaction if the journal
-- does not balance. Nothing in the application can post an unbalanced journal,
-- including a raw SQL session.

CREATE OR REPLACE FUNCTION nabd_assert_journal_balanced() RETURNS trigger AS $$
DECLARE
  v_debit    BIGINT;
  v_credit   BIGINT;
  v_count    INT;
  v_currency CHAR(3);
  v_mismatch INT;
BEGIN
  SELECT
    COALESCE(SUM(amount_minor) FILTER (WHERE direction = 'DEBIT'), 0),
    COALESCE(SUM(amount_minor) FILTER (WHERE direction = 'CREDIT'), 0),
    COUNT(*)
  INTO v_debit, v_credit, v_count
  FROM ledger_entries
  WHERE journal_id = NEW.journal_id;

  -- The journal may have been rolled back; nothing to check.
  IF v_count = 0 THEN
    RETURN NULL;
  END IF;

  IF v_count < 2 THEN
    RAISE EXCEPTION
      'NABD: journal % has % entry — a posting needs at least two',
      NEW.journal_id, v_count
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION
      'NABD: journal % does not balance — debits % <> credits %',
      NEW.journal_id, v_debit, v_credit
      USING ERRCODE = 'check_violation';
  END IF;

  -- Every entry must share the journal's currency. A journal that mixes
  -- currencies "balances" numerically while being meaningless.
  SELECT currency INTO v_currency FROM journals WHERE id = NEW.journal_id;
  SELECT COUNT(*) INTO v_mismatch
  FROM ledger_entries
  WHERE journal_id = NEW.journal_id AND currency <> v_currency;

  IF v_mismatch > 0 THEN
    RAISE EXCEPTION
      'NABD: journal % mixes currencies — % entries differ from %',
      NEW.journal_id, v_mismatch, v_currency
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_entries_balance_check
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION nabd_assert_journal_balanced();

-- ── immutability ────────────────────────────────────────────────────────────
-- Financial history and audit trail cannot be rewritten, by anyone, ever.

CREATE TRIGGER journals_immutable
  BEFORE UPDATE OR DELETE ON journals
  FOR EACH ROW EXECUTE FUNCTION nabd_reject_mutation();

CREATE TRIGGER ledger_entries_immutable
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION nabd_reject_mutation();

-- ── reconciliation ──────────────────────────────────────────────────────────
-- Re-derives every balance from raw entries and shows the cache beside it.
-- Any row where `drift` is non-zero is an incident.

CREATE VIEW ledger_reconciliation AS
SELECT
  la.id                                   AS ledger_account_id,
  la.code,
  la.currency,
  la.normal_balance,
  COALESCE(d.debit, 0)                    AS derived_debit_minor,
  COALESCE(d.credit, 0)                   AS derived_credit_minor,
  b.posted_debit_minor                    AS cached_debit_minor,
  b.posted_credit_minor                   AS cached_credit_minor,
  (COALESCE(d.debit, 0) - b.posted_debit_minor)
    + (COALESCE(d.credit, 0) - b.posted_credit_minor) AS drift,
  CASE la.normal_balance
    WHEN 'DEBIT'  THEN COALESCE(d.debit, 0) - COALESCE(d.credit, 0)
    ELSE               COALESCE(d.credit, 0) - COALESCE(d.debit, 0)
  END                                     AS derived_balance_minor,
  b.hold_minor
FROM ledger_accounts la
JOIN ledger_account_balances b ON b.ledger_account_id = la.id
LEFT JOIN (
  SELECT
    ledger_account_id,
    SUM(amount_minor) FILTER (WHERE direction = 'DEBIT')  AS debit,
    SUM(amount_minor) FILTER (WHERE direction = 'CREDIT') AS credit
  FROM ledger_entries
  GROUP BY ledger_account_id
) d ON d.ledger_account_id = la.id;

-- The accounting identity, per currency. Both columns must always match.
CREATE VIEW ledger_trial_balance AS
SELECT
  currency,
  SUM(amount_minor) FILTER (WHERE direction = 'DEBIT')  AS total_debit_minor,
  SUM(amount_minor) FILTER (WHERE direction = 'CREDIT') AS total_credit_minor,
  SUM(amount_minor) FILTER (WHERE direction = 'DEBIT')
    - SUM(amount_minor) FILTER (WHERE direction = 'CREDIT') AS imbalance_minor
FROM ledger_entries
GROUP BY currency;

-- ── transactions ────────────────────────────────────────────────────────────

CREATE TABLE transactions (
  id                  UUID PRIMARY KEY,
  type                transaction_type     NOT NULL,
  status              transaction_status   NOT NULL DEFAULT 'INITIATED',
  amount_minor        BIGINT               NOT NULL,
  fee_minor           BIGINT               NOT NULL DEFAULT 0,
  currency            CHAR(3)              NOT NULL,
  sender_account_id   UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  receiver_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  user_id             UUID REFERENCES users(id) ON DELETE RESTRICT,
  reference           TEXT NOT NULL UNIQUE,
  idempotency_key     TEXT NOT NULL UNIQUE,
  category            transaction_category NOT NULL DEFAULT 'OTHER',
  description         TEXT,
  risk_score          INT,
  failure_reason      TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at        TIMESTAMPTZ,
  CONSTRAINT transactions_amount_positive CHECK (amount_minor > 0),
  CONSTRAINT transactions_fee_non_negative CHECK (fee_minor >= 0),
  CONSTRAINT transactions_risk_range CHECK (risk_score IS NULL OR (risk_score BETWEEN 0 AND 100)),
  CONSTRAINT transactions_has_party CHECK (
    sender_account_id IS NOT NULL OR receiver_account_id IS NOT NULL
  )
);
CREATE INDEX transactions_sender_idx   ON transactions (sender_account_id, created_at DESC);
CREATE INDEX transactions_receiver_idx ON transactions (receiver_account_id, created_at DESC);
CREATE INDEX transactions_user_idx     ON transactions (user_id, created_at DESC);
-- Partial index over non-terminal states: the reconciliation sweep reads this
-- constantly and it stays tiny regardless of total volume.
CREATE INDEX transactions_in_flight_idx ON transactions (status, created_at)
  WHERE status IN ('INITIATED','PENDING','PROCESSING');

ALTER TABLE journals
  ADD CONSTRAINT journals_transaction_fk
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT;

CREATE TABLE beneficiaries (
  id                 UUID PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alias              TEXT NOT NULL,
  full_name          TEXT NOT NULL,
  bank_name          TEXT,
  iban_enc           BYTEA,
  account_number_enc BYTEA,
  encryption_key_id  TEXT,
  -- Non-reversible fingerprint of the destination, so duplicates are detectable
  -- without the plaintext ever being indexed.
  destination_hash   TEXT NOT NULL,
  currency           CHAR(3) NOT NULL,
  status             beneficiary_status NOT NULL DEFAULT 'PENDING',
  -- A newly added beneficiary cannot receive funds until this passes. It is the
  -- single most effective control against account-takeover cash-out.
  cooldown_until     TIMESTAMPTZ,
  verified_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);
CREATE UNIQUE INDEX beneficiaries_unique_destination
  ON beneficiaries (user_id, destination_hash) WHERE deleted_at IS NULL;
CREATE INDEX beneficiaries_user_idx ON beneficiaries (user_id) WHERE deleted_at IS NULL;

CREATE TABLE transfers (
  id             UUID PRIMARY KEY,
  transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
  beneficiary_id UUID REFERENCES beneficiaries(id) ON DELETE SET NULL,
  rail           TEXT NOT NULL DEFAULT 'INTERNAL',
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id             UUID PRIMARY KEY,
  transaction_id UUID NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE RESTRICT,
  provider       TEXT NOT NULL,
  provider_ref   TEXT,
  method         payment_method NOT NULL,
  merchant_name  TEXT,
  qr_payload_hash TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_ref)
);

CREATE TABLE cards (
  id                UUID PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  provider          TEXT NOT NULL,
  provider_card_id  TEXT NOT NULL,
  type              card_type   NOT NULL,
  status            card_status NOT NULL DEFAULT 'PENDING',
  brand             TEXT,
  -- Last four only. NABD never stores a PAN, a CVV, or a card secret; those
  -- live exclusively with the licensed issuer.
  last4             CHAR(4),
  expiry_month      SMALLINT,
  expiry_year       SMALLINT,
  daily_limit_minor BIGINT,
  monthly_limit_minor BIGINT,
  frozen_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_card_id),
  CONSTRAINT cards_last4_digits CHECK (last4 IS NULL OR last4 ~ '^[0-9]{4}$'),
  CONSTRAINT cards_expiry_month CHECK (expiry_month IS NULL OR expiry_month BETWEEN 1 AND 12)
);
CREATE INDEX cards_user_idx ON cards (user_id);

-- ── KYC ─────────────────────────────────────────────────────────────────────

CREATE TABLE kyc_applications (
  id               UUID PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           kyc_status NOT NULL DEFAULT 'NOT_STARTED',
  level            kyc_level  NOT NULL DEFAULT 'BASIC',
  provider         TEXT,
  provider_ref     TEXT,
  full_name        TEXT,
  nationality      TEXT,
  rejection_reason TEXT,
  submitted_at     TIMESTAMPTZ,
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX kyc_applications_user_idx ON kyc_applications (user_id, created_at DESC);
CREATE INDEX kyc_applications_status_idx ON kyc_applications (status);

CREATE TABLE kyc_documents (
  id                UUID PRIMARY KEY,
  application_id    UUID NOT NULL REFERENCES kyc_applications(id) ON DELETE CASCADE,
  type              kyc_document_type NOT NULL,
  -- The bytes live in encrypted object storage. Only the key is stored here, so
  -- a database compromise does not yield identity documents.
  storage_key       TEXT NOT NULL,
  encryption_key_id TEXT NOT NULL,
  content_type      TEXT,
  size_bytes        BIGINT,
  sha256            TEXT,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
CREATE INDEX kyc_documents_application_idx ON kyc_documents (application_id);

-- ── risk & compliance ───────────────────────────────────────────────────────

CREATE TABLE fraud_cases (
  id             UUID PRIMARY KEY,
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  risk_score     INT NOT NULL,
  level          risk_level  NOT NULL,
  status         case_status NOT NULL DEFAULT 'OPEN',
  signals        JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by    UUID,
  resolution     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMPTZ,
  CONSTRAINT fraud_cases_score_range CHECK (risk_score BETWEEN 0 AND 100)
);
CREATE INDEX fraud_cases_open_idx ON fraud_cases (level, created_at DESC)
  WHERE status IN ('OPEN','REVIEWING');

CREATE TABLE compliance_cases (
  id           UUID PRIMARY KEY,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  type         compliance_case_type NOT NULL,
  status       case_status NOT NULL DEFAULT 'OPEN',
  severity     risk_level  NOT NULL DEFAULT 'LOW',
  provider     TEXT,
  provider_ref TEXT,
  details      JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_to  UUID,
  resolution   TEXT,
  opened_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at    TIMESTAMPTZ
);
CREATE INDEX compliance_cases_open_idx ON compliance_cases (status, opened_at DESC);

CREATE TABLE security_events (
  id         UUID PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  device_id  UUID REFERENCES devices(id) ON DELETE SET NULL,
  type       TEXT NOT NULL,
  severity   risk_level NOT NULL DEFAULT 'LOW',
  ip         INET,
  user_agent TEXT,
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX security_events_user_idx ON security_events (user_id, created_at DESC);
CREATE INDEX security_events_type_idx ON security_events (type, created_at DESC);

-- ── audit ───────────────────────────────────────────────────────────────────

CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY,
  actor_id      TEXT,
  actor_type    TEXT NOT NULL,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT,
  before        JSONB,
  after         JSONB,
  reason        TEXT,
  ip            INET,
  device_id     TEXT,
  request_id    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_resource_idx ON audit_logs (resource_type, resource_id, created_at DESC);
CREATE INDEX audit_logs_actor_idx    ON audit_logs (actor_id, created_at DESC);
CREATE INDEX audit_logs_action_idx   ON audit_logs (action, created_at DESC);

-- No administrator, at any privilege level in the application, can alter or
-- erase the audit trail.
CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION nabd_reject_mutation();

-- ── operations ──────────────────────────────────────────────────────────────

CREATE TABLE admin_users (
  id             UUID PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  role           admin_role NOT NULL,
  -- MFA is not optional on the admin plane; the API refuses login without it.
  mfa_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret_enc BYTEA,
  last_login_at  TIMESTAMPTZ,
  last_login_ip  INET,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at    TIMESTAMPTZ
);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel    notification_channel NOT NULL,
  event      TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  status     notification_status NOT NULL DEFAULT 'QUEUED',
  attempts   INT NOT NULL DEFAULT 0,
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at    TIMESTAMPTZ,
  read_at    TIMESTAMPTZ
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_pending_idx ON notifications (status, created_at)
  WHERE status = 'QUEUED';

CREATE TABLE support_tickets (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  number      TEXT NOT NULL UNIQUE,
  subject     TEXT NOT NULL,
  status      ticket_status   NOT NULL DEFAULT 'OPEN',
  priority    ticket_priority NOT NULL DEFAULT 'NORMAL',
  category    TEXT,
  assigned_to UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX support_tickets_user_idx ON support_tickets (user_id, created_at DESC);
CREATE INDEX support_tickets_queue_idx ON support_tickets (status, priority, created_at);

CREATE TABLE support_messages (
  id          UUID PRIMARY KEY,
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL,
  author_type TEXT NOT NULL,
  body        TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  internal    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_ticket_idx ON support_messages (ticket_id, created_at);

-- The API-level idempotency record, distinct from the ledger's. This one stores
-- the response so a replayed request returns the original body verbatim.
CREATE TABLE idempotency_keys (
  key             TEXT PRIMARY KEY,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL,
  -- Hash of the request body. A key reused with a *different* body is a client
  -- bug and must be rejected, not silently replayed.
  request_hash    TEXT NOT NULL,
  status          idempotency_status NOT NULL DEFAULT 'IN_FLIGHT',
  response_status INT,
  response_body   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX idempotency_keys_expiry_idx ON idempotency_keys (expires_at);

CREATE TABLE webhook_events (
  id              UUID PRIMARY KEY,
  direction       webhook_direction NOT NULL,
  provider        TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  external_id     TEXT,
  signature_valid BOOLEAN,
  payload         JSONB NOT NULL,
  status          webhook_status NOT NULL DEFAULT 'PENDING',
  attempts        INT NOT NULL DEFAULT 0,
  last_error      TEXT,
  next_retry_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ
);
-- Webhook idempotency: a provider redelivering the same event must not be
-- processed twice.
CREATE UNIQUE INDEX webhook_events_external_key
  ON webhook_events (provider, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX webhook_events_retry_idx ON webhook_events (next_retry_at)
  WHERE status IN ('PENDING','FAILED');

-- Transactional outbox: side effects are written in the same transaction as the
-- money movement, then relayed after commit. Nothing external is called while a
-- balance row is locked.
CREATE TABLE outbox_events (
  id             UUID PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id   TEXT NOT NULL,
  event_type     TEXT NOT NULL,
  payload        JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at   TIMESTAMPTZ,
  attempts       INT NOT NULL DEFAULT 0
);
CREATE INDEX outbox_unpublished_idx ON outbox_events (created_at)
  WHERE published_at IS NULL;

CREATE TABLE consents (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope       TEXT NOT NULL,
  purpose     TEXT NOT NULL,
  third_party TEXT,
  status      consent_status NOT NULL DEFAULT 'GRANTED',
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX consents_user_idx ON consents (user_id, status);

CREATE TABLE schema_migrations (
  version    TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (version) VALUES ('0001_init');

COMMIT;
