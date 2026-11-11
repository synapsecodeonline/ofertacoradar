<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Comandos

- `npm run dev` — dev server
- `npm run build` / `npm run start` — build e produção
- `npm run sync` — importa o feed de ofertas (URL em `FEED_URL` no `.env`) para o banco SQLite via Prisma
- `npm run db:push` — aplica mudanças do `prisma/schema.prisma`
- Banco: SQLite em `prisma/dev.db` (Prisma 6, `prisma-client-js`)

## Notas

- Next.js 16 com `cacheComponents` desligado (renderização dinâmica simples).
- Fontes de produtos: `LOMADEE_API_KEY` (API affiliate) ou `FEED_URL` (XML/JSON genérico → `fetchFeed`). API tem precedência.
- Com `LOMADEE_API_KEY`, o sync importa **campanhas** (`/affiliate/campaigns`, status `onTime`) — são ofertas/cupons com `lmdee.link` já rastreado por canal = comissão. Catalogo de produtos (`/affiliate/products`) só entra com `LOMADEE_PRODUCTS=1` e usa link direto da loja (SEM comissão).
- API Lomadee: limite de 20 itens/página em brands/campaigns, rate limit 60 req/min, 500 intermitente em algumas páginas (sync pula e segue). Paginação: campaigns/orders usam `meta`, brands usa `pagination`, products usa `count`.
- Feed XML: campos mapeados de forma tolerante (title/name, price/preco, link/url, image/imagem etc.).
- Atenção: API de produtos retorna URL direta da loja; link comissionado pode exigir feed XML lomadeezado ou shortener (`POST /affiliate/shortener/url`).
- Redirect de afiliado: `/ir/[id]` registra clique e redireciona para `affiliateUrl` (ou `url`).
