-- Development seed: 20 transactions for the demo user.
--
-- Two things about this file are deliberate:
--
--  1. Every transaction is a REAL posting — a balanced journal with two entries
--     and a matching balance-cache update. Nothing writes a balance directly.
--     Seed data that cheats would hide exactly the bugs this schema exists to
--     prevent, and the reconciliation view would immediately flag it.
--
--  2. The 20 transactions net to zero for the demo user, so the opening balance
--     of 12,850.75 SAR from fixtures.sql is also the closing balance — a
--     plausible month of salary in and spending out.
--
-- NEVER run this against production. tools/db/seed.sh refuses to.

BEGIN;

DO $seed$
DECLARE
  v_alice      UUID := '00000000-0000-7000-8000-00000000aa01'; -- demo user's ledger account
  v_bob        UUID := '00000000-0000-7000-8000-00000000aa02';
  v_settlement UUID := '00000000-0000-7000-8000-0000000005e7';
  v_alice_acct UUID := '00000000-0000-7000-8000-0000000acc01';
  v_bob_acct   UUID := '00000000-0000-7000-8000-0000000acc02';
  v_user       UUID := '00000000-0000-7000-8000-00000000a11c';

  v_journal    UUID;
  v_txn        UUID;
  v_counter    UUID;
  v_ref        TEXT;
  r            RECORD;
  i            INT := 0;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- direction, amount (halalas), description, category, counterparty, days ago
      ('IN',   750000, 'Salary — September',        'INCOME',        'SETTLEMENT', 28),
      ('OUT',  379800, 'Rent',                      'BILLS',         'SETTLEMENT', 27),
      ('OUT',   48000, 'Electricity bill',          'BILLS',         'SETTLEMENT', 26),
      ('OUT',   11500, 'Mobile bill',               'BILLS',         'SETTLEMENT', 25),
      ('OUT',   32550, 'Grocery store',             'FOOD',          'SETTLEMENT', 24),
      ('OUT',   15000, 'Fuel',                      'TRANSPORT',     'SETTLEMENT', 22),
      ('OUT',  200000, 'Transfer to Bob',           'TRANSFER',      'BOB',        21),
      ('IN',    45000, 'Refund — returned order',   'SHOPPING',      'SETTLEMENT', 20),
      ('OUT',   87000, 'Online shopping',           'SHOPPING',      'SETTLEMENT', 19),
      ('OUT',   12000, 'Restaurant',                'FOOD',          'SETTLEMENT', 18),
      ('OUT',    2350, 'Coffee',                    'FOOD',          'SETTLEMENT', 17),
      ('IN',    25000, 'Transfer from Bob',         'TRANSFER',      'BOB',        15),
      ('OUT',   18900, 'Pharmacy',                  'OTHER',         'SETTLEMENT', 14),
      ('OUT',    4500, 'Taxi',                      'TRANSPORT',     'SETTLEMENT', 12),
      ('IN',     5000, 'Cashback',                  'INCOME',        'SETTLEMENT', 10),
      ('OUT',    8000, 'Cinema',                    'ENTERTAINMENT', 'SETTLEMENT', 8),
      ('OUT',    3900, 'Streaming subscription',    'ENTERTAINMENT', 'SETTLEMENT', 6),
      ('IN',    15000, 'Transfer from Bob',         'TRANSFER',      'BOB',        4),
      ('OUT',   26500, 'Restaurant',                'FOOD',          'SETTLEMENT', 2),
      ('IN',    10000, 'Refund — cancelled order',  'SHOPPING',      'SETTLEMENT', 1)
    ) AS t(direction, amount, description, category, counterparty, days_ago)
  LOOP
    i := i + 1;
    v_journal := gen_random_uuid();
    v_txn     := gen_random_uuid();
    v_ref     := 'NBD-SEED-' || LPAD(i::TEXT, 4, '0');
    v_counter := CASE WHEN r.counterparty = 'BOB' THEN v_bob ELSE v_settlement END;

    INSERT INTO transactions (
      id, type, status, amount_minor, currency,
      sender_account_id, receiver_account_id, user_id,
      reference, idempotency_key, category, description, created_at, processed_at
    ) VALUES (
      v_txn,
      CASE WHEN r.category = 'TRANSFER' THEN 'TRANSFER'
           WHEN r.direction = 'IN' THEN 'TOPUP'
           ELSE 'PAYMENT' END::transaction_type,
      'COMPLETED',
      r.amount,
      'SAR',
      CASE WHEN r.direction = 'OUT' THEN v_alice_acct
           WHEN r.counterparty = 'BOB' THEN v_bob_acct ELSE NULL END,
      CASE WHEN r.direction = 'IN'  THEN v_alice_acct
           WHEN r.counterparty = 'BOB' THEN v_bob_acct ELSE NULL END,
      v_user,
      v_ref,
      'seed-txn-' || i,
      r.category::transaction_category,
      r.description,
      now() - (r.days_ago || ' days')::INTERVAL,
      now() - (r.days_ago || ' days')::INTERVAL
    );

    INSERT INTO journals (id, reference, idempotency_key, currency, description, transaction_id, posted_at)
    VALUES (v_journal, v_ref, 'seed-journal-' || i, 'SAR', r.description, v_txn,
            now() - (r.days_ago || ' days')::INTERVAL);

    IF r.direction = 'IN' THEN
      -- Money in: the counterparty is debited, the customer credited.
      INSERT INTO ledger_entries (id, journal_id, ledger_account_id, direction, amount_minor, currency, sequence)
      VALUES (gen_random_uuid(), v_journal, v_counter, 'DEBIT',  r.amount, 'SAR', 0),
             (gen_random_uuid(), v_journal, v_alice,   'CREDIT', r.amount, 'SAR', 1);

      UPDATE ledger_account_balances
         SET posted_debit_minor = posted_debit_minor + r.amount, version = version + 1
       WHERE ledger_account_id = v_counter;
      UPDATE ledger_account_balances
         SET posted_credit_minor = posted_credit_minor + r.amount, version = version + 1
       WHERE ledger_account_id = v_alice;
    ELSE
      -- Money out: the customer is debited, the counterparty credited.
      INSERT INTO ledger_entries (id, journal_id, ledger_account_id, direction, amount_minor, currency, sequence)
      VALUES (gen_random_uuid(), v_journal, v_alice,   'DEBIT',  r.amount, 'SAR', 0),
             (gen_random_uuid(), v_journal, v_counter, 'CREDIT', r.amount, 'SAR', 1);

      UPDATE ledger_account_balances
         SET posted_debit_minor = posted_debit_minor + r.amount, version = version + 1
       WHERE ledger_account_id = v_alice;
      UPDATE ledger_account_balances
         SET posted_credit_minor = posted_credit_minor + r.amount, version = version + 1
       WHERE ledger_account_id = v_counter;
    END IF;
  END LOOP;

  RAISE NOTICE 'Seeded % transactions', i;
END
$seed$;

-- Assert the seed produced exactly what it claims. A seed file that silently
-- drifts is worse than no seed at all: every screenshot and demo built on it
-- would be wrong.
DO $verify$
DECLARE
  v_balance  BIGINT;
  v_count    INT;
  v_drift    BIGINT;
  v_imbalance BIGINT;
BEGIN
  SELECT derived_balance_minor INTO v_balance
    FROM ledger_reconciliation WHERE code LIKE 'user:%acc01';
  SELECT COUNT(*) INTO v_count FROM transactions WHERE reference LIKE 'NBD-SEED-%';
  SELECT COALESCE(SUM(ABS(drift)), 0) INTO v_drift FROM ledger_reconciliation;
  SELECT COALESCE(SUM(ABS(imbalance_minor)), 0) INTO v_imbalance FROM ledger_trial_balance;

  IF v_count <> 20 THEN
    RAISE EXCEPTION 'Seed produced % transactions, expected 20', v_count;
  END IF;
  IF v_balance <> 1285075 THEN
    RAISE EXCEPTION 'Demo balance is % halalas, expected 1285075 (12,850.75 SAR)', v_balance;
  END IF;
  IF v_drift <> 0 THEN
    RAISE EXCEPTION 'Balance cache drifted from the entries by %', v_drift;
  END IF;
  IF v_imbalance <> 0 THEN
    RAISE EXCEPTION 'Trial balance does not net to zero: %', v_imbalance;
  END IF;

  RAISE NOTICE 'Seed verified: 20 transactions, balance 12,850.75 SAR, zero drift, books balanced.';
END
$verify$;

COMMIT;
