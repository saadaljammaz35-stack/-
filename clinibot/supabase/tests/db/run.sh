#!/usr/bin/env bash
# Builds a throwaway database, applies every migration in order on top of the
# Supabase stub, then runs each test file. Any failed assertion aborts with a
# non-zero exit code.
#
# Uses the standard libpq environment (PGHOST, PGPORT, PGUSER, PGPASSWORD).
# The connecting role must be a superuser (it creates roles and databases).

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS="$HERE/../../migrations"
DB="${CLINIBOT_TEST_DB:-clinibot_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 --no-psqlrc -o /dev/null -d "$DB")

dropdb --if-exists "$DB"
createdb "$DB"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true' EXIT

"${PSQL[@]}" -f "$HERE/00_supabase_stubs.sql"

for migration in "$MIGRATIONS"/*.sql; do
  echo "migrate  $(basename "$migration")"
  "${PSQL[@]}" -f "$migration"
done

for test_file in "$HERE"/[1-9][0-9]_*.sql; do
  echo "test     $(basename "$test_file")"
  "${PSQL[@]}" -f "$test_file"
done

echo "All database tests passed."
