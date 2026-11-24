#!/usr/bin/env bash
# Cron 1min: despacha scrapes pedidos pelo botao no /admin/servicos.
# flock evita dispatchers sobrepostos (o anterior pode estar rodando
# um scrape de 30min+). Sem pedidos, sai em ~1s.
set -u
cd "$(dirname "$0")/.." || exit 1

NODE_DIR="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)"
export PATH="$NODE_DIR/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

exec 9>/tmp/.scrape-dispatch.lock
flock -n 9 || exit 0

LOG=logs/scrape-dispatch.log
mkdir -p logs
[ -f "$LOG" ] && [ "$(stat -c%s "$LOG")" -gt 1048576 ] && tail -c 524288 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"

echo "===== $(date -Is) =====" >> "$LOG"
npx tsx --env-file=.env scripts/scrape-dispatch.ts >> "$LOG" 2>&1
echo "dispatch exit=$? $(date -Is)" >> "$LOG"
