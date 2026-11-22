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
- Rotinas agendadas rodam no **GitHub Actions** (grátis), não mais em cron local: `.github/workflows/kit.yml` (kit diário 8h BRT = 11h UTC) e `recategorize.yml` (domingo 6h BRT = 9h UTC). Secrets no repo: DATABASE_URL, RESEND_*, KIT_*, CRON_SECRET, NEXT_PUBLIC_SITE_URL. O histórico anti-repetição do kit fica em `ScriptState` (key `kit-sent`) — `sent.json` local é só fallback. Healthcheck: `KIT_HEALTHCHECK_URL` (healthchecks.io).
- Tabelas novas no Supabase: `db push` falha no pooler e o usuário `ofertacoradar_app` não tem DDL — criar via SQL Editor (ver `scripts/migration-*.sql`) e `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` (RLS vem ativo e bloqueia o app).
