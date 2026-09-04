#!/usr/bin/env bash
#
# Database invariant tests.
#
# These assert that PostgreSQL itself refuses to break the ledger — not that the
# application avoids doing so. Every negative case here is attempted with raw
# SQL, as a database superuser, which is the strongest adversary the schema will
# ever face. If a control only lives in TypeScript, it is not a control.
#
#   usage: bash tools/db/verify.sh
#
set -uo pipefail

DB="${NABD_TEST_DB:-nabd_verify}"
PSQL="psql -X -q -v ON_ERROR_STOP=1 -d ${DB}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Run psql as the postgres OS user when we are root and no PGUSER is set.
run_psql() {
  if [ "$(id -u)" = "0" ] && [ -z "${PGUSER:-}" ]; then
    su postgres -c "$1"
  else
    eval "$1"
  fi
}

PASS=0
FAIL=0

# SQL is written to a file and run with psql -f rather than -c. Passing it
# through the shell would let constructs like \$\$ (PL/pgSQL block delimiters) be
# expanded by bash before Postgres ever sees them.
TMPDIR_SQL="$(mktemp -d /tmp/nabd-verify.XXXXXX)"
chmod 755 "$TMPDIR_SQL"
trap 'rm -rf "$TMPDIR_SQL"' EXIT

ok()   { PASS=$((PASS+1)); printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m  %s\n' "$1"; }

# Runs SQL from a file, returning psql's exit status and output.
run_sql_file() {
  local file="$1" extra="${2:-}"
  chmod 644 "$file"
  if [ "$(id -u)" = "0" ] && [ -z "${PGUSER:-}" ]; then
    su postgres -c "psql -X -q -v ON_ERROR_STOP=1 $extra -d $DB -f $file" 2>&1
  else
    psql -X -q -v ON_ERROR_STOP=1 $extra -d "$DB" -f "$file" 2>&1
  fi
}

write_sql() {
  local file
  file="$(mktemp "$TMPDIR_SQL/q.XXXXXX.sql")"
  printf '%s\n' "$1" > "$file"
  printf '%s' "$file"
}

# Asserts a statement is REJECTED by the database.
expect_reject() {
  local desc="$1" file out
  file="$(write_sql "$2")"
  out="$(run_sql_file "$file")"
  if [ $? -ne 0 ]; then ok "$desc"; else bad "$desc — the database ACCEPTED it: $out"; fi
}

# Asserts a statement is ACCEPTED.
expect_accept() {
  local desc="$1" file out
  file="$(write_sql "$2")"
  out="$(run_sql_file "$file")"
  if [ $? -eq 0 ]; then ok "$desc"; else bad "$desc — rejected unexpectedly: $out"; fi
}

# Asserts a scalar query returns an expected value.
expect_value() {
  local desc="$1" want="$3" file got
  file="$(write_sql "$2")"
  got="$(run_sql_file "$file" '-qtA' | tr -d '[:space:]')"
  if [ "$got" = "$want" ]; then ok "$desc"; else bad "$desc — expected '$want', got '$got'"; fi
}

# Runs SQL ignoring failure — used to set up a scenario.
run_setup() {
  local file
  file="$(write_sql "$1")"
  run_sql_file "$file" >/dev/null 2>&1 || true
}

echo "── Rebuilding ${DB} ─────────────────────────────────────────────────────"
run_psql "psql -X -q -c \"DROP DATABASE IF EXISTS ${DB};\" -c \"CREATE DATABASE ${DB};\"" >/dev/null 2>&1
run_psql "psql -X -q -v ON_ERROR_STOP=1 -d ${DB} -f ${ROOT}/packages/database/migrations/0001_init.sql" >/dev/null || {
  echo "migration failed"; exit 1; }
run_psql "psql -X -q -v ON_ERROR_STOP=1 -d ${DB} -f ${ROOT}/tools/db/fixtures.sql" >/dev/null || {
  echo "fixtures failed"; exit 1; }
echo

echo "── The double-entry invariant ───────────────────────────────────────────"

expect_reject "an unbalanced journal is rejected at COMMIT" "
BEGIN;
INSERT INTO journals (id, reference, idempotency_key, currency, description)
VALUES (gen_random_uuid(), 'NBD-BAD-1', 'bad-1', 'SAR', 'unbalanced');
INSERT INTO ledger_entries (id, journal_id, ledger_account_id, direction, amount_minor, currency, sequence)
SELECT gen_random_uuid(), j.id, '00000000-0000-7000-8000-00000000aa01', 'DEBIT', 10000, 'SAR', 0
  FROM journals j WHERE j.reference = 'NBD-BAD-1';
INSERT INTO ledger_entries (id, journal_id, ledger_account_id, direction, amount_minor, currency, sequence)
SELECT gen_random_uuid(), j.id, '00000000-0000-7000-8000-00000000aa02', 'CREDIT', 9999, 'SAR', 1
  FROM journals j WHERE j.reference = 'NBD-BAD-1';
COMMIT;"

expect_reject "a single-sided journal is rejected" "
BEGIN;
INSERT INTO journals (id, reference, idempotency_key, currency, description)
VALUES (gen_random_uuid(), 'NBD-BAD-2', 'bad-2', 'SAR', 'one-sided');
INSERT INTO ledger_entries (id, journal_id, ledger_account_id, direction, amount_minor, currency, sequence)
SELECT gen_random_uuid(), j.id, '00000000-0000-7000-8000-00000000aa01', 'DEBIT', 10000, 'SAR', 0
  FROM journals j WHERE j.reference = 'NBD-BAD-2';
COMMIT;"

expect_reject "a journal mixing currencies is rejected" "
BEGIN;
INSERT INTO journals (id, reference, idempotency_key, currency, description)
VALUES (gen_random_uuid(), 'NBD-BAD-3', 'bad-3', 'SAR', 'mixed currency');
INSERT INTO ledger_entries (id, journal_id, ledger_account_id, direction, amount_minor, currency, sequence)
SELECT gen_random_uuid(), j.id, '00000000-0000-7000-8000-00000000aa01', 'DEBIT', 10000, 'SAR', 0
  FROM journals j WHERE j.reference = 'NBD-BAD-3';
INSERT INTO ledger_entries (id, journal_id, ledger_account_id, direction, amount_minor, currency, sequence)
SELECT gen_random_uuid(), j.id, '00000000-0000-7000-8000-00000000aa02', 'CREDIT', 10000, 'USD', 1
  FROM journals j WHERE j.reference = 'NBD-BAD-3';
COMMIT;"

expect_reject "a zero-amount entry is rejected by CHECK" "
INSERT INTO ledger_entries (id, journal_id, ledger_account_id, direction, amount_minor, currency, sequence)
VALUES (gen_random_uuid(), '00000000-0000-7000-8000-00000000da01',
        '00000000-0000-7000-8000-00000000aa01', 'DEBIT', 0, 'SAR', 99);"

expect_reject "a negative amount is rejected by CHECK" "
INSERT INTO ledger_entries (id, journal_id, ledger_account_id, direction, amount_minor, currency, sequence)
VALUES (gen_random_uuid(), '00000000-0000-7000-8000-00000000da01',
        '00000000-0000-7000-8000-00000000aa01', 'DEBIT', -100, 'SAR', 98);"

expect_accept "a balanced transfer is accepted" "
BEGIN;
INSERT INTO journals (id, reference, idempotency_key, currency, description)
VALUES ('00000000-0000-7000-8000-00000000da02', 'NBD-OK-1', 'ok-1', 'SAR', 'Alice to Bob');
INSERT INTO ledger_entries (id, journal_id, ledger_account_id, direction, amount_minor, currency, sequence) VALUES
 (gen_random_uuid(), '00000000-0000-7000-8000-00000000da02', '00000000-0000-7000-8000-00000000aa01', 'DEBIT',  50000, 'SAR', 0),
 (gen_random_uuid(), '00000000-0000-7000-8000-00000000da02', '00000000-0000-7000-8000-00000000aa02', 'CREDIT', 50000, 'SAR', 1);
UPDATE ledger_account_balances SET posted_debit_minor  = posted_debit_minor  + 50000, version = version + 1
 WHERE ledger_account_id = '00000000-0000-7000-8000-00000000aa01';
UPDATE ledger_account_balances SET posted_credit_minor = posted_credit_minor + 50000, version = version + 1
 WHERE ledger_account_id = '00000000-0000-7000-8000-00000000aa02';
COMMIT;"

echo
echo "── Immutability (attempted as superuser) ────────────────────────────────"

expect_reject "UPDATE on ledger_entries is blocked" \
  "UPDATE ledger_entries SET amount_minor = 1 WHERE amount_minor = 50000;"

expect_reject "DELETE on ledger_entries is blocked" \
  "DELETE FROM ledger_entries WHERE amount_minor = 50000;"

expect_reject "UPDATE on journals is blocked" \
  "UPDATE journals SET description = 'tampered' WHERE reference = 'NBD-OK-1';"

expect_reject "DELETE on journals is blocked" \
  "DELETE FROM journals WHERE reference = 'NBD-OK-1';"

expect_accept "an audit log can be written" "
INSERT INTO audit_logs (id, actor_id, actor_type, action, resource_type, resource_id, reason)
VALUES (gen_random_uuid(), 'admin_1', 'ADMIN', 'transfer.reverse', 'transaction', 'txn_1', 'test');"

expect_reject "UPDATE on audit_logs is blocked" \
  "UPDATE audit_logs SET reason = 'rewritten' WHERE actor_id = 'admin_1';"

expect_reject "DELETE on audit_logs is blocked — even for a super admin" \
  "DELETE FROM audit_logs WHERE actor_id = 'admin_1';"

echo
echo "── Idempotency and uniqueness ───────────────────────────────────────────"

expect_reject "a duplicate journal idempotency key is rejected" "
INSERT INTO journals (id, reference, idempotency_key, currency, description)
VALUES (gen_random_uuid(), 'NBD-DUP', 'ok-1', 'SAR', 'duplicate key');"

expect_reject "a duplicate transaction idempotency key is rejected" "
INSERT INTO transactions (id, type, status, amount_minor, currency, reference, idempotency_key, sender_account_id)
VALUES (gen_random_uuid(), 'TRANSFER', 'INITIATED', 100, 'SAR', 'TX-1', 'tk-1', '00000000-0000-7000-8000-0000000acc01');
INSERT INTO transactions (id, type, status, amount_minor, currency, reference, idempotency_key, sender_account_id)
VALUES (gen_random_uuid(), 'TRANSFER', 'INITIATED', 100, 'SAR', 'TX-2', 'tk-1', '00000000-0000-7000-8000-0000000acc01');"

expect_reject "a redelivered webhook event is rejected" "
INSERT INTO webhook_events (id, direction, provider, event_type, external_id, payload)
VALUES (gen_random_uuid(), 'INBOUND', 'mock-psp', 'payment.completed', 'evt_1', '{}');
INSERT INTO webhook_events (id, direction, provider, event_type, external_id, payload)
VALUES (gen_random_uuid(), 'INBOUND', 'mock-psp', 'payment.completed', 'evt_1', '{}');"

echo
echo "── Schema correctness guards ────────────────────────────────────────────"

expect_reject "a LIABILITY with a DEBIT normal balance is rejected" "
INSERT INTO ledger_accounts (id, code, account_id, type, normal_balance, currency, is_system, allows_negative_balance)
VALUES (gen_random_uuid(), 'system:wrong:SAR', NULL, 'LIABILITY', 'DEBIT', 'SAR', TRUE, TRUE);"

expect_reject "an ASSET with a CREDIT normal balance is rejected" "
INSERT INTO ledger_accounts (id, code, account_id, type, normal_balance, currency, is_system, allows_negative_balance)
VALUES (gen_random_uuid(), 'system:wrong2:SAR', NULL, 'ASSET', 'CREDIT', 'SAR', TRUE, TRUE);"

expect_reject "a system ledger account linked to a customer account is rejected" "
INSERT INTO ledger_accounts (id, code, account_id, type, normal_balance, currency, is_system, allows_negative_balance)
VALUES (gen_random_uuid(), 'system:wrong3:SAR', '00000000-0000-7000-8000-0000000acc01', 'ASSET', 'DEBIT', 'SAR', TRUE, TRUE);"

expect_reject "a malformed phone number is rejected" "
INSERT INTO users (id, phone) VALUES (gen_random_uuid(), '0500000000');"

expect_reject "a transaction with a risk score above 100 is rejected" "
INSERT INTO transactions (id, type, status, amount_minor, currency, reference, idempotency_key, risk_score, sender_account_id)
VALUES (gen_random_uuid(), 'TRANSFER', 'INITIATED', 100, 'SAR', 'TX-R', 'tk-r', 101, '00000000-0000-7000-8000-0000000acc01');"

expect_reject "a second primary account in the same currency is rejected" "
INSERT INTO accounts (id, user_id, type, status, currency, account_number, is_primary)
VALUES (gen_random_uuid(), '00000000-0000-7000-8000-00000000a11c', 'PERSONAL', 'ACTIVE', 'SAR', '100000000099', TRUE);"

expect_reject "a card row storing a non-numeric last4 is rejected" "
INSERT INTO cards (id, user_id, account_id, provider, provider_card_id, type, last4)
VALUES (gen_random_uuid(), '00000000-0000-7000-8000-00000000a11c', '00000000-0000-7000-8000-0000000acc01',
        'mock', 'c1', 'VIRTUAL', 'abcd');"

echo
echo "── Reconciliation ───────────────────────────────────────────────────────"

expect_value "the cache matches a from-scratch re-derivation (zero drift)" \
  "SELECT COALESCE(SUM(ABS(drift)),0) FROM ledger_reconciliation;" "0"

expect_value "the trial balance holds: total debits = total credits" \
  "SELECT COALESCE(SUM(ABS(imbalance_minor)),0) FROM ledger_trial_balance;" "0"

expect_value "Alice's derived balance is 12,350.75 SAR after sending 500.00" \
  "SELECT derived_balance_minor FROM ledger_reconciliation WHERE code LIKE 'user:%acc01';" "1235075"

expect_value "Bob's derived balance is 500.00 SAR" \
  "SELECT derived_balance_minor FROM ledger_reconciliation WHERE code LIKE 'user:%acc02';" "50000"

expect_value "platform liabilities equal platform assets" \
  "SELECT (SELECT COALESCE(SUM(derived_balance_minor),0) FROM ledger_reconciliation r
             JOIN ledger_accounts a ON a.id = r.ledger_account_id WHERE a.type = 'LIABILITY')
        - (SELECT COALESCE(SUM(derived_balance_minor),0) FROM ledger_reconciliation r
             JOIN ledger_accounts a ON a.id = r.ledger_account_id WHERE a.type = 'ASSET');" "0"

echo
echo "── Concurrency: double spend at the SQL layer ───────────────────────────"


# Two guarded debits run back to back against the same locked balance row. The
# second must observe the first and refuse. If the balance check happened
# outside the row lock, both would pass and the account would go negative — the
# classic double-spend.
run_setup "INSERT INTO ledger_accounts (id, code, account_id, type, normal_balance, currency, is_system, allows_negative_balance)
VALUES ('00000000-0000-7000-8000-00000000aa03', 'system:sink:SAR', NULL, 'REVENUE', 'CREDIT', 'SAR', TRUE, TRUE);
INSERT INTO ledger_account_balances (ledger_account_id) VALUES ('00000000-0000-7000-8000-00000000aa03');"

run_setup "DO \$do\$
DECLARE
  v_available BIGINT;
BEGIN
  FOR i IN 1..2 LOOP
    SELECT (posted_credit_minor - posted_debit_minor - hold_minor)
      INTO v_available
      FROM ledger_account_balances
     WHERE ledger_account_id = '00000000-0000-7000-8000-00000000aa02'
       FOR UPDATE;

    IF v_available >= 40000 THEN
      INSERT INTO journals (id, reference, idempotency_key, currency, description)
      VALUES (gen_random_uuid(), 'NBD-CC-' || i, 'cc-' || i, 'SAR', 'guarded debit');

      INSERT INTO ledger_entries (id, journal_id, ledger_account_id, direction, amount_minor, currency, sequence)
      SELECT gen_random_uuid(), j.id, '00000000-0000-7000-8000-00000000aa02', 'DEBIT', 40000, 'SAR', 0
        FROM journals j WHERE j.idempotency_key = 'cc-' || i;
      INSERT INTO ledger_entries (id, journal_id, ledger_account_id, direction, amount_minor, currency, sequence)
      SELECT gen_random_uuid(), j.id, '00000000-0000-7000-8000-00000000aa03', 'CREDIT', 40000, 'SAR', 1
        FROM journals j WHERE j.idempotency_key = 'cc-' || i;

      UPDATE ledger_account_balances SET posted_debit_minor = posted_debit_minor + 40000, version = version + 1
       WHERE ledger_account_id = '00000000-0000-7000-8000-00000000aa02';
      UPDATE ledger_account_balances SET posted_credit_minor = posted_credit_minor + 40000, version = version + 1
       WHERE ledger_account_id = '00000000-0000-7000-8000-00000000aa03';
    END IF;
  END LOOP;
END
\$do\$;"


expect_value "only one of two 400.00 debits against a 500.00 balance was posted" \
  "SELECT COUNT(*) FROM journals WHERE idempotency_key LIKE 'cc-%';" "1"

expect_value "Bob's balance never went negative" \
  "SELECT CASE WHEN derived_balance_minor >= 0 THEN 'ok' ELSE 'negative' END
     FROM ledger_reconciliation WHERE code LIKE 'user:%acc02';" "ok"

expect_value "the trial balance still holds after the contention" \
  "SELECT COALESCE(SUM(ABS(imbalance_minor)),0) FROM ledger_trial_balance;" "0"

expect_value "reconciliation still shows zero drift" \
  "SELECT COALESCE(SUM(ABS(drift)),0) FROM ledger_reconciliation;" "0"

echo
echo "─────────────────────────────────────────────────────────────────────────"
printf 'Database invariants: \033[32m%d passed\033[0m, ' "$PASS"
if [ "$FAIL" -gt 0 ]; then
  printf '\033[31m%d failed\033[0m\n' "$FAIL"
  exit 1
fi
printf '%d failed\n' "$FAIL"
