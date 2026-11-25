#!/usr/bin/env bash
# Applies every migration in supabase/migrations to a throwaway local PostgreSQL (with a small Supabase shim)
# and runs the RLS/permission assertions in tests/sql/rls.test.sql.
# Requires the PostgreSQL server binaries (initdb, pg_ctl) on PATH or in /usr/lib/postgresql/*/bin.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")"
WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-55439}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  # PostgreSQL refuses to run as root; use the postgres system user when available.
  chown -R postgres "$WORK" 2>/dev/null || true
  RUN_AS=(su postgres -s /bin/bash -c)
fi

run() {
  if [ ${#RUN_AS[@]} -gt 0 ]; then "${RUN_AS[@]}" "$*"; else bash -c "$*"; fi
}

cleanup() {
  run "'$PG_BIN/pg_ctl' -D '$WORK/data' -m immediate stop" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

run "'$PG_BIN/initdb' -D '$WORK/data' -U postgres --encoding=UTF8 --locale=C.UTF-8 >/dev/null"
run "'$PG_BIN/pg_ctl' -D '$WORK/data' -o '-p $PORT -k $WORK -c listen_addresses=' -l '$WORK/log' -w start >/dev/null"

PSQL=(psql -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f "$ROOT/tests/sql/00_supabase_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "applying $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "re-applying migrations to check they are idempotent"
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$f"
done
echo "running tests/sql/rls.test.sql"
"${PSQL[@]}" -f "$ROOT/tests/sql/rls.test.sql"
echo "database tests passed"
