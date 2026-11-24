#!/usr/bin/env bash
# Wrapper do scrape ML para cron.
# Preferencia: container Docker (deploy/ml). Fallback: execucao local.
# ATENCAO: a sessao ML expira — se o log mostrar "sessao provavelmente
# expirou", rode `npx tsx scripts/ml-login.ts` e refaca o login.
set -u
cd "$(dirname "$0")/.." || exit 1

ML_DIR="deploy/ml"
if docker info >/dev/null 2>&1; then
  docker compose -f "$ML_DIR/docker-compose.yml" --profile scrape run --rm scrape >> logs/ml-cron.log 2>&1
  exit $?
fi

NODE_DIR="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)"
export PATH="$NODE_DIR/bin:$PATH"

mkdir -p logs
LOG=logs/ml-scrape.log
[ -f "$LOG" ] && [ "$(stat -c%s "$LOG")" -gt 1048576 ] && tail -c 524288 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

echo "===== $(date -Is) [local] =====" >> "$LOG"
npx tsx --env-file=.env scripts/ml-scrape.ts --pages "${ML_PAGES:-1}" --max-new "${ML_MAX_NEW:-60}" --delay "${ML_DELAY:-5000}" >> "$LOG" 2>&1
echo "scrape exit=$? $(date -Is)" >> "$LOG"
