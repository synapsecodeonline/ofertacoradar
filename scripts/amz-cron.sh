#!/usr/bin/env bash
# Wrapper do scrape Amazon para cron.
# Preferencia: container Docker (deploy/amazon). Fallback: execucao
# local via npx (caso o Docker Desktop esteja desligado).
set -u
cd "$(dirname "$0")/.." || exit 1

AMZ_DIR="deploy/amazon"
if docker info >/dev/null 2>&1; then
  docker compose -f "$AMZ_DIR/docker-compose.yml" --profile scrape run --rm scrape >> logs/amz-cron.log 2>&1
  exit $?
fi

# ---- fallback local ----
NODE_DIR="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)"
export PATH="$NODE_DIR/bin:$PATH"

mkdir -p logs
LOG=logs/amz-scrape.log
[ -f "$LOG" ] && [ "$(stat -c%s "$LOG")" -gt 1048576 ] && tail -c 524288 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

echo "===== $(date -Is) [local] =====" >> "$LOG"
npx tsx --env-file=.env scripts/amz-scrape.ts --max-new 5 >> "$LOG" 2>&1
echo "scrape exit=$? $(date -Is)" >> "$LOG"
npx tsx --env-file=.env scripts/amz-verify.ts >> "$LOG" 2>&1
echo "verify exit=$? $(date -Is)" >> "$LOG"
