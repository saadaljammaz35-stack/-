#!/usr/bin/env bash
#
# Development seed data.
#
# Refuses to run against production. Seed data in a production database means a
# "Demo User" exists with a spendable balance, which is both a security hole and
# an accounting lie — those halalas would appear in the platform's liabilities.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

if [ "${NODE_ENV:-development}" = "production" ]; then
  echo "REFUSING: seed data must never exist in production." >&2
  exit 1
fi
if [ "${ENABLE_SEED_DATA:-true}" != "true" ]; then
  echo "REFUSING: ENABLE_SEED_DATA is not true." >&2
  exit 1
fi

DB_URL="${DATABASE_URL:-postgresql://nabd:nabd@localhost:5432/nabd_dev}"
case "$DB_URL" in
  *prod*|*production*)
    echo "REFUSING: DATABASE_URL looks like production." >&2
    exit 1 ;;
esac

echo "Seeding development data..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f tools/db/fixtures.sql
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f tools/db/seed-transactions.sql
echo "Seed complete. Demo user: +966500000001 — balance 12,850.75 SAR"
