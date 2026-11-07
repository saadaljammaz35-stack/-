#!/bin/sh
# For container hosting without a built-in scheduler: run beside the app.
# Calls the job runner every 60 seconds.  APP_URL and CRON_SECRET must be set.
while true; do
  curl -fsS -m 290 -H "Authorization: Bearer ${CRON_SECRET}" "${APP_URL}/api/cron/jobs" >/dev/null || echo "cron call failed $(date -u)"
  sleep 60
done
