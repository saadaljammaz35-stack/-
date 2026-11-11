#!/usr/bin/env bash
# Creates a LOCAL development database with three login roles:
#   omnix_owner        owns the schema, runs migrations and backups; BYPASSRLS
#                      so pg_dump sees every row      (MIGRATION_DATABASE_URL)
#   omnix_app_login    member of omnix_app, RLS applies   (DATABASE_URL)
#   omnix_worker_login member of omnix_worker             (WORKER_DATABASE_URL)
# Development only. Passwords here are local placeholders, never production.
#   usage: scripts/dev-db.sh [dbname]     (default: omnix_dev)
set -euo pipefail
DB="${1:-omnix_dev}"
PSQL=(psql -v ON_ERROR_STOP=1 -h "${PGHOST:-localhost}" -U "${PGSUPERUSER:-postgres}" -d postgres)
"${PSQL[@]}" <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='omnix_owner') THEN CREATE ROLE omnix_owner LOGIN PASSWORD 'omnix_owner_dev' CREATEROLE BYPASSRLS; END IF;
  ALTER ROLE omnix_owner BYPASSRLS;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='omnix_app') THEN CREATE ROLE omnix_app NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='omnix_worker') THEN CREATE ROLE omnix_worker NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='omnix_definer') THEN CREATE ROLE omnix_definer NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='omnix_app_login') THEN CREATE ROLE omnix_app_login LOGIN PASSWORD 'omnix_app_dev' IN ROLE omnix_app; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='omnix_worker_login') THEN CREATE ROLE omnix_worker_login LOGIN PASSWORD 'omnix_worker_dev' IN ROLE omnix_worker; END IF;
END \$\$;
SQL
# The owner hands SECURITY DEFINER functions to omnix_definer (migration 0006).
"${PSQL[@]}" -qc "GRANT omnix_definer TO omnix_owner WITH SET TRUE"
if ! "${PSQL[@]}" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB}'" | grep -q 1; then
  "${PSQL[@]}" -c "CREATE DATABASE \"${DB}\" OWNER omnix_owner"
fi
# pgvector must be created by a superuser on plain PostgreSQL.
psql -v ON_ERROR_STOP=1 -h "${PGHOST:-localhost}" -U "${PGSUPERUSER:-postgres}" -d "$DB" -c "CREATE EXTENSION IF NOT EXISTS vector"
echo "ready: ${DB}"
echo "MIGRATION_DATABASE_URL=postgres://omnix_owner:omnix_owner_dev@localhost:5432/${DB}"
echo "DATABASE_URL=postgres://omnix_app_login:omnix_app_dev@localhost:5432/${DB}"
echo "WORKER_DATABASE_URL=postgres://omnix_worker_login:omnix_worker_dev@localhost:5432/${DB}"
