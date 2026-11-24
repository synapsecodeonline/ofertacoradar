#!/usr/bin/env bash
# Equivalente containerizado do scripts/amz-cron.sh:
# scrape (max 5 novos) + verify de elegibilidade.
set -u
cd /app

LOG=/app/logs/amz-scrape.log
mkdir -p /app/logs
[ -f "$LOG" ] && [ "$(stat -c%s "$LOG")" -gt 1048576 ] && tail -c 524288 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

echo "===== $(date -Is) [docker] =====" >> "$LOG"
# "$@" primeiro: --max-new/--queries do dispatcher (admin) tem
# precedencia — o arg() usa a 1a ocorrencia da flag.
npx tsx --env-file=.env scripts/amz-scrape.ts "$@" --max-new 5 >> "$LOG" 2>&1
echo "scrape exit=$? $(date -Is)" >> "$LOG"
npx tsx --env-file=.env scripts/amz-verify.ts >> "$LOG" 2>&1
echo "verify exit=$? $(date -Is)" >> "$LOG"
