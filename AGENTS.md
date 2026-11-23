<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Comandos

- `npm run dev` — dev server
- `npm run build` / `npm run start` — build e produção
- `npm run sync` — importa ofertas para o Postgres via Prisma
- `npm run checklinks` — varredura única: desativa produtos cujo link do parceiro está morto (404/página "não encontrada"); `ml:` não é checado (anti-bot)
- `npm run db:push` — aplica mudanças do `prisma/schema.prisma` (pode travar no Supabase pooler; alternativa: `ALTER TABLE` via `$executeRawUnsafe`)
- Banco: PostgreSQL no Supabase (`DATABASE_URL`), Prisma 6 `prisma-client-js`
- `DATABASE_URL` usa `connection_limit=5` (pooler Supabase multiplexa; `=1` estrangulava a home em ~20s). O sync em background usa `syncPrisma` (`src/lib/db.ts`) com pool próprio `connection_limit=2` para não competir com as queries da página — `src/lib/syncer.ts` e `src/lib/mercadolivre.ts` importam `syncPrisma as prisma`.
- `NEXT_PUBLIC_SITE_URL` — domínio canônico usado em sitemap/metadata/JSON-LD (fallback: `VERCEL_URL` ou localhost)
- `.env.example` documenta todas as env vars (sem valores). Ao adicionar var nova, registrar lá.
- Widget Chatwoot: `src/components/ChatwootWidget.tsx` (`next/script` afterInteractive, no root layout). URL/token default apontam p/ `chat.ofertacoradar.com.br`; override via `NEXT_PUBLIC_CHATWOOT_BASE_URL`/`NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN`.

## Notas

- Next.js 16 com `cacheComponents` desligado (renderização dinâmica simples).
- Fontes de afiliado (prefixo em `Product.externalId`): `camp-lomadee:` = oferta/cupom **Lomadee**, `prod-lomadee:` = produto **Lomadee**, `ml:` = produto **Mercado Livre**, `aw:` = produto **Awin**. `LOMADEE_API_KEY` (API Lomadee) ou `FEED_URL` (XML/JSON genérico → `fetchFeed`, também Lomadee). API tem precedência.
- Com `LOMADEE_API_KEY`, o sync importa **campanhas** (`/affiliate/campaigns`, status `onTime`) — são ofertas/cupons com `lmdee.link` já rastreado por canal = comissão. Catalogo de produtos (`/affiliate/products`) só entra com `LOMADEE_PRODUCTS=1` e usa link direto da loja (SEM comissão).
- API Lomadee: limite de 20 itens/página em brands/campaigns, rate limit 60 req/min, 500 intermitente em algumas páginas (sync pula e segue). Paginação: campaigns/orders usam `meta`, brands usa `pagination`, products usa `count`.
- Feed XML: campos mapeados de forma tolerante (title/name, price/preco, link/url, image/imagem etc.).
- Atenção: API de produtos retorna URL direta da loja; link comissionado pode exigir feed XML lomadeezado ou shortener (`POST /affiliate/shortener/url`).
- Redirect de afiliado: `/ir/[id]` registra clique e redireciona para `affiliateUrl` (ou `url`; produtos `prod-lomadee:` sem affiliateUrl geram `lmdee.link` via shortener, cacheado em `TrackedLink`).
- `Product.discountPct` — % de desconto calculado no sync (alimenta ordenação "Maior desconto" e relacionadas). Manter atualizado em `scripts/sync.ts` e `src/lib/syncer.ts`.
- Home tem abas/ordenação/filtros via query params: `aba` (ofertas|lojas|ml|awin — cada aba e uma fonte, sem misturar), `q`, `categoria`, `loja`, `ordem` (desconto|recentes|terminando|populares), `pagina`. URLs `/ir/` ficam fora do sitemap e são `Disallow` no robots.
- Rotinas agendadas: **cron-job.org → GitHub Actions** (grátis), não cron local. O gatilho oficial é `workflow_dispatch` via API do GitHub (cron-job.org é pontual); o `schedule:` do workflow é só backup — free tier do GH pula/atrasa execuções. `.github/workflows/kit.yml` (kit diário 8h BRT) e `recategorize.yml` (dom 6h BRT). Secrets no repo: DATABASE_URL, RESEND_*, KIT_*, CRON_SECRET, NEXT_PUBLIC_SITE_URL. O histórico anti-repetição do kit fica em `ScriptState` (key `kit-sent`) — `sent.json` local é só fallback. Healthcheck: `KIT_HEALTHCHECK_URL` (healthchecks.io).
- Queries pesadas do kit (`ORDER BY discountPct` em ~20k produtos) cobertas por `Product_kit_discount_idx` (ver `scripts/migration-product-discount-idx.sql`) + `withRetry` no `daily-kit.ts` — statement_timeout do pooler é transitório quando o sync compete.
- Tabelas novas no Supabase: `db push` falha no pooler e o usuário `ofertacoradar_app` não tem DDL — criar via SQL Editor (ver `scripts/migration-*.sql`) e `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` (RLS vem ativo e bloqueia o app). Conexão direta `db.<ref>.supabase.co` é IPv6-only — usar session pooler `aws-1-us-east-1.pooler.supabase.com:5432` com user `postgres.<ref>` quando precisar de DDL/master.
- Scrape Amazon roda em **Docker** (`deploy/amazon/`, imagem `mcr.microsoft.com/playwright` + repo montado): cron `amz-cron.sh` chama `docker compose run --rm scrape` com fallback local se Docker estiver off. Precisa de IP residencial (Amazon bloqueia datacenter) e sessão em `~/.config/ofertacoradar/amz-state.json` (montada no container). Profile `scrape` — não sobe com `up -d`.
- **Chatwoot self-hosted local** (`deploy/chatwoot/`, WSL2 + Docker Desktop): compose com `chatwoot/chatwoot:v4.17.1-ce`, **`pgvector/pgvector:pg16`** (obrigatório — schema usa extensão `vector`), redis:7-alpine, caddy. `.env` local (não commitar — tem segredos). Subir: `docker compose up -d`; migrations: `docker compose exec rails bundle exec rails db:chatwoot_prepare`. Exposição pública via container `chatwoot-tunnel` (cloudflared) com **túnel nomeado** `chat.ofertacoradar.com.br` → `rails:3000`; credenciais em `deploy/chatwoot/cloudflared/` (gitignored — gerar com `cloudflared tunnel login` + `tunnel create` + `tunnel route dns`). DNS do domínio já está na Cloudflare (nameservers `lilith`/`melnicoff.ns.cloudflare.com`) — **mas os registros do site ficam "DNS only" (proxy OFF)**: proxy da Cloudflare na frente da Vercel bufferizava o HTML streaming e levava ~20s/página. Só o `chat.` passa pelo túnel. Todo serviço cloud free exige cartão — por isso é local.
