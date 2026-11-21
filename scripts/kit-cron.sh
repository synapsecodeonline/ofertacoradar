#!/usr/bin/env bash
# Wrapper do kit diario para cron — resolve o node do nvm (cron nao herda PATH)
# e loga em logs/kit-daily.log com rotacao simples (>1MB trunca).
set -u
cd "$(dirname "$0")/.." || exit 1

NODE_DIR="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)"
export PATH="$NODE_DIR/bin:$PATH"

mkdir -p logs
LOG=logs/kit-daily.log
[ -f "$LOG" ] && [ "$(stat -c%s "$LOG")" -gt 1048576 ] && : > "$LOG"

echo "=== $(date -Is) kit:daily ===" >> "$LOG"
npm run kit:daily >> "$LOG" 2>&1
