#!/usr/bin/env bash
#
# Apply migrations in order, skipping any already recorded in
# schema_migrations. Forward-only: migrations are never edited once merged, and
# there are no DOWN migrations — reversing a migration on financial data risks
# destroying records. Recovery from a bad migration is a new migration.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

DB_URL="${DATABASE_URL:-postgresql://nabd:nabd@localhost:5432/nabd_dev}"
MIGRATIONS_DIR="packages/database/migrations"

psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );" >/dev/null

applied=0
for file in "$MIGRATIONS_DIR"/*.sql; do
  version="$(basename "$file" .sql)"
  exists="$(psql "$DB_URL" -tA -c \
    "SELECT 1 FROM schema_migrations WHERE version = '$version'")"

  if [ "$exists" = "1" ]; then
    echo "  skip    $version (already applied)"
    continue
  fi

  echo "  apply   $version"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$file"
  applied=$((applied + 1))
done

echo "Migrations complete. $applied applied."
