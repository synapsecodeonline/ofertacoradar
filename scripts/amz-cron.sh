#!/usr/bin/env bash
# Wrapper do scrape Amazon para cron — resolve o node do nvm (cron nao herda PATH)
# e loga em logs/amz-scrape.log com rotacao simples (>1MB trunca).
set -u
cd "$(dirname "$0")/.." || exit 1

NODE_DIR="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)"
export PATH="$NODE_DIR/bin:$PATH"

mkdir -p logs
LOG=logs/amz-scrape.log
[ -f "$LOG" ] && [ "$(stat -c%s "$LOG")" -gt 1048576 ] && tail -c 524288 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

echo "===== $(date -Is) =====" >> "$LOG"
npx tsx --env-file=.env scripts/amz-scrape.ts "$@" >> "$LOG" 2>&1
echo "exit=$? $(date -Is)" >> "$LOG"
