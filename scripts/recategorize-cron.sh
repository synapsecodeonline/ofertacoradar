#!/usr/bin/env bash
# Wrapper do recategorize para cron — resolve o node do nvm (cron nao
# herda PATH) e loga em logs/recategorize.log com rotacao simples.
set -u
cd "$(dirname "$0")/.." || exit 1

NODE_DIR="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)"
export PATH="$NODE_DIR/bin:$PATH"

mkdir -p logs
LOG=logs/recategorize.log
[ -f "$LOG" ] && [ "$(stat -c%s "$LOG")" -gt 1048576 ] && : > "$LOG"

echo "=== $(date -Is) recategorize ===" >> "$LOG"
npm run recategorize -- --apply >> "$LOG" 2>&1
