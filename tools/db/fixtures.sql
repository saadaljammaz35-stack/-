-- Development fixture: two customers, their ledger accounts, and the system
-- accounts for SAR. Opening balances are created by POSTING a funding journal,
-- never by writing a number into a balance row — the same rule the application
-- follows.

BEGIN;

INSERT INTO users (id, phone, email, status, kyc_status) VALUES
  ('00000000-0000-7000-8000-00000000a11c', '+966500000001', 'alice@example.test', 'ACTIVE', 'VERIFIED'),
  ('00000000-0000-7000-8000-00000000b0b0', '+966500000002', 'bob@example.test',   'ACTIVE', 'VERIFIED');

INSERT INTO accounts (id, user_id, type, status, currency, account_number, is_primary) VALUES
  ('00000000-0000-7000-8000-0000000acc01', '00000000-0000-7000-8000-00000000a11c', 'PERSONAL', 'ACTIVE', 'SAR', '100000000001', TRUE),
  ('00000000-0000-7000-8000-0000000acc02', '00000000-0000-7000-8000-00000000b0b0', 'PERSONAL', 'ACTIVE', 'SAR', '100000000002', TRUE);

INSERT INTO profiles (user_id, first_name, last_name, locale, nationality) VALUES
  ('00000000-0000-7000-8000-00000000a11c', 'Demo',  'User', 'ar', 'SA'),
  ('00000000-0000-7000-8000-00000000b0b0', 'Second','User', 'ar', 'SA');

-- Customer money is a LIABILITY of the platform.
INSERT INTO ledger_accounts
  (id, code, account_id, type, normal_balance, currency, is_system, allows_negative_balance, description) VALUES
  ('00000000-0000-7000-8000-00000000aa01', 'user:00000000-0000-7000-8000-0000000acc01',
   '00000000-0000-7000-8000-0000000acc01', 'LIABILITY', 'CREDIT', 'SAR', FALSE, FALSE, 'Alice wallet'),
  ('00000000-0000-7000-8000-00000000aa02', 'user:00000000-0000-7000-8000-0000000acc02',
   '00000000-0000-7000-8000-0000000acc02', 'LIABILITY', 'CREDIT', 'SAR', FALSE, FALSE, 'Bob wallet'),
  ('00000000-0000-7000-8000-0000000005e7', 'system:settlement:SAR',
   NULL, 'ASSET', 'DEBIT', 'SAR', TRUE, TRUE, 'Funds held at partner institution'),
  ('00000000-0000-7000-8000-00000000feed', 'system:fees:SAR',
   NULL, 'REVENUE', 'CREDIT', 'SAR', TRUE, TRUE, 'Fee income');

INSERT INTO ledger_account_balances (ledger_account_id)
SELECT id FROM ledger_accounts;

-- Fund Alice with 12,850.75 SAR by posting a real journal.
INSERT INTO journals (id, reference, idempotency_key, currency, description) VALUES
  ('00000000-0000-7000-8000-00000000da01', 'NBD-SEED-ALICE', 'seed-alice', 'SAR', 'Opening funding');

INSERT INTO ledger_entries (id, journal_id, ledger_account_id, direction, amount_minor, currency, sequence) VALUES
  (gen_random_uuid(), '00000000-0000-7000-8000-00000000da01',
   '00000000-0000-7000-8000-0000000005e7', 'DEBIT',  1285075, 'SAR', 0),
  (gen_random_uuid(), '00000000-0000-7000-8000-00000000da01',
   '00000000-0000-7000-8000-00000000aa01', 'CREDIT', 1285075, 'SAR', 1);

UPDATE ledger_account_balances
   SET posted_debit_minor = posted_debit_minor + 1285075, version = version + 1
 WHERE ledger_account_id = '00000000-0000-7000-8000-0000000005e7';
UPDATE ledger_account_balances
   SET posted_credit_minor = posted_credit_minor + 1285075, version = version + 1
 WHERE ledger_account_id = '00000000-0000-7000-8000-00000000aa01';

COMMIT;
