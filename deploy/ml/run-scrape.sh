#!/usr/bin/env bash
# Scrape ML agendado: roda o ml-scrape com cota pequena por execucao
# (sessao ML e sensivel a volume — melhor varias execucoes curtas).
set -u
cd /app

LOG=/app/logs/ml-scrape.log
mkdir -p /app/logs
[ -f "$LOG" ] && [ "$(stat -c%s "$LOG")" -gt 1048576 ] && tail -c 524288 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

echo "===== $(date -Is) [docker] =====" >> "$LOG"
# "$@" primeiro: args do dispatcher (admin) tem precedencia — o arg()
# dos scrapers usa a 1a ocorrencia da flag.
npx tsx --env-file=.env scripts/ml-scrape.ts "$@" --pages "${ML_PAGES:-1}" --max-new "${ML_MAX_NEW:-60}" --delay "${ML_DELAY:-5000}" >> "$LOG" 2>&1
echo "scrape exit=$? $(date -Is)" >> "$LOG"
