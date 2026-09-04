#!/usr/bin/env bash
# Start local infrastructure and wait for it to be genuinely ready.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

docker compose up -d
echo "Waiting for PostgreSQL..."
for _ in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U nabd -d nabd_dev >/dev/null 2>&1; then
    echo "PostgreSQL is ready."
    exit 0
  fi
  sleep 1
done
echo "PostgreSQL did not become ready in time." >&2
exit 1
