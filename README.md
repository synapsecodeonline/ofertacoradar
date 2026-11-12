# Ofertaço 🏷️

Site brasileiro de **cupons, ofertas e produtos com links de afiliado Lomadee**. Vitine de descontos com foco em SEO, conversão e monetização via comissões de afiliado.

**Produção:** https://ofertacoradar.vercel.app

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, `cacheComponents` off) |
| UI | React 19 + Tailwind CSS 4 |
| Banco | PostgreSQL (Supabase) via Prisma 6 (`prisma-client-js`) |
| Deploy | Vercel |
| Parser de feed | `fast-xml-parser` |
| Imagens sociais | `next/og` (`ImageResponse`) |
| Scripts | `tsx` |
| Fontes | Geist via `next/font` no site; Inter sob demanda nas imagens `/api/card` |

> ⚠️ Este projeto usa uma versão **não padrão** do Next.js. Antes de codar, consulte `node_modules/next/dist/docs/` e o bloco em `AGENTS.md` (regras de APIs/convenções).

---

## Setup local

```bash
npm install          # também roda `prisma generate` no postinstall
# crie o .env com DATABASE_URL + LOMADEE_API_KEY ou FEED_URL (ver seção de variáveis)
npm run db:push      # aplica o schema no Postgres
npm run sync         # opcional: importa ofertas/produtos na hora
npm run dev          # http://localhost:3000
```

Sem `LOMADEE_API_KEY`, use `FEED_URL` apontando para um feed XML/JSON de ofertas.

---

## Rotas e endpoints

| Rota | Tipo | Descrição |
|---|---|---|
| `/` | página | Home dinâmica (`force-dynamic`): abas, busca, filtros, ordenação, paginação e seções de destaque. |
| `/produto/[id]` | página | Detalhe do item: preço, cupom, countdown, prova social, relacionados, share e JSON-LD. |
| `/ir/[id]` | route handler | Redirect 302 para a loja/oferta, registrando `Click`. Suporta `?src=` → `utm_source` no destino final. |
| `/api/card/[id]` | route handler | PNG de divulgação via `next/og`: `?size=feed` (1080×1080, default) ou `?size=story` (1080×1920). |
| `/sitemap.xml` | metadata route | Home + até 5.000 produtos ativos. |
| `/robots.txt` | metadata route | Libera tudo exceto `/ir/`; aponta para o sitemap. |

### `/ir/[id]` em detalhe

1. Busca o `Product` ativo; se não existir, redireciona para `/`.
2. Cria um `Click` assíncrono com `referer` e `userAgent` (truncado em 500 chars).
3. Se o produto **não** tiver `affiliateUrl` mas tiver `organizationId` (catálogo `prod:*`), chama `POST /affiliate/shortener/url`, cacheia em `TrackedLink` e redireciona para o `lmdee.link` gerado; se falhar, cai na `url` direta.
4. Caso contrário, redireciona para `affiliateUrl ?? url`; `?src=...` vira `utm_source` na URL de destino.

---

## Funcionalidades

### Monetização / Afiliados

- **Ofertas/cupons** (`externalId` `camp:*`): campanhas Lomadee com link `lmdee.link` já rastreado — comissão por conversão.
- **Catálogo de produtos** (`prod:*`): produtos de lojas afiliadas; o link comissionado é gerado **no clique** via `POST /affiliate/shortener/url` e cacheado em `TrackedLink`.
- `/ir/[id]` é o **único caminho de saída** para lojas e registra `Click` sem bloquear o redirect.
- Disclosure de afiliado no footer, na página do produto e no texto dos CTAs.

### UX / Conversão

- **Hero** com estatísticas reais (produtos, ofertas e lojas), chips de lojas parceiras com logo/nome e carrossel de **ofertas em destaque** (top 5 por desconto da aba/filtros atuais, troca a cada 6s, pausa no hover, setas e dots).
- Abas **Produtos** (default) e **Ofertas e Cupons** (`?aba=produtos|ofertas`).
- **Busca** (`?q=`) em título, descrição e merchant; **filtro de loja** (`?loja=`, merchant case-insensitive); **categoria** (`?categoria=` canônica, casando slugs legados no banco).
- **Ordenações** (`?ordem=`): `desconto` (default em Ofertas), `recentes` (default em Produtos), `terminando` e `populares` (por total de cliques). Filtros, busca, loja e ordenação viram query params; mudanças resetam `pagina`.
- **Paginação** apenas na aba Produtos: 48 itens/página (`pagina`). A aba Ofertas mostra até 120 itens sem paginação.
- Itens exibidos exigem `active`, `imageUrl`, preço diferente de 0 quando informado e `endsAt` nulo ou futuro.
- **Faixa "Ofertas Relâmpago"**: `endsAt` entre agora e +48h, até 12 itens ordenados pelo fim mais próximo, countdown ao vivo por segundo e scroll horizontal. Independe da aba e respeita `q`/`categoria`/`loja`; esses itens são removidos do grid principal para não duplicar.
- **"Aproveitadas agora"**: seção global com os produtos mais clicados nas últimas 48h (até 12), com badge de cliques. Cards da listagem mostram prova social de cliques dos últimos 30 dias quando ≥ 3.
- Página de produto: breadcrumb, imagem, badges `-%`, cupom copiável, **"Economize R$ X"**, countdown real (<7 dias), lista **"Por que aproveitar agora"** (desconto, economia, cupom, urgência, loja e cliques), selos de confiança, **"como usar o cupom"**, relacionados (mesma loja primeiro, depois mesma categoria), botões **WhatsApp / Copiar link**, botões **"Imagem p/ feed" / "Imagem p/ story"** (`/api/card`) e **CTA fixo no mobile**.
- Botão **Voltar** (`router.back()` com fallback) na página de produto.
- Tema claro/escuro manual (`ThemeToggle`, `localStorage["theme"]`); script inline aplica o tema salvo antes do paint e usa `prefers-color-scheme` quando não há preferência salva.
- Barra de **categorias** em painel expansível animado: abre no load/topo, fecha ao descer (>160px), reabre no topo, sticky, grid de tiles com avatar colorido por hash do slug; fecha com Esc/clique fora.

### Categorias

- Conjunto canônico de **34 categorias** em PT-BR (`src/lib/categories.ts`).
- `resolveCategory(raw, title)`: mapa de aliases de slugs Lomadee/catálogo (`home-and-decoration`, `womens_clothing`...) → canônico; fallback por **32 regras de palavras-chave** (regex pt-BR) no título; fallback final `outros`.
- `canonicalCategory()` / `rawSlugsFor()` fazem filtros do banco casarem todos os formatos legados.
- A navegação só mostra categorias que têm itens válidos na aba/filtros atuais.
- Backfill: `scripts/_backfill.ts` (uso único, já executado) — recalcula `category` e preenche `merchant` via `AffiliatedOrg`.

### SEO

- `sitemap.xml` dinâmico: home + produtos ativos (até 5.000, ordenados por `updatedAt`).
- `robots.txt`: `allow: /`, `disallow: /ir/`, sitemap canônico.
- Metadata global com template `%s | Ofertaço Radar`, keywords pt-BR, Open Graph `pt_BR` e Twitter `summary_large_image`.
- Páginas de produto: canonical próprio, OG/Twitter com imagem do produto e JSON-LD `Product`/`Offer` (preço, moeda, disponibilidade, `validThrough`, seller).
- Home, páginas de produto, `/api/card` e `sitemap.xml` usam `force-dynamic` (dados sempre frescos).
- `loading.tsx` (skeleton de cards) e `not-found.tsx` em pt-BR.

---

## Modelo de dados (`prisma/schema.prisma`)

- **Product** — ofertas e produtos: `externalId` (`camp:`/`prod:`, unique), `title`, `description`, `imageUrl`, `price`/`oldPrice`/`discountPct`, `currency` (default `BRL`), `category`, `merchant`, `organizationId`, `url`, `affiliateUrl`, `couponCode`, `endsAt`, `active`, timestamps; índices em `category` e `active`; relação `clicks`.
- **Click** — cliques em `/ir/[id]`: `productId`, `referer`, `userAgent`, `createdAt`; índice em `productId`.
- **TrackedLink** — cache `sourceUrl → shortUrl` do shortener (`organizationId`, `createdAt`).
- **AffiliatedOrg** — organizações afiliadas vistas nas campanhas (`organizationId`, `name`); base para filtrar o catálogo e fallback de merchant.
- **Brand** — marcas Lomadee (`id` = organizationId, `name`, `logo`, `site`).
- **SyncState** — estado do sync incremental: `key`, `phase`, `page`, `lastCycleAt`, `busyAt`, `orgsCleared`.

---

## Variáveis de ambiente (`.env`)

| Var | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres (Supabase) — pooled (`pgbouncer`) |
| `LOMADEE_API_KEY` | uma das duas* | API affiliate Lomadee (`x-api-key`); também habilita sync incremental e shortener |
| `LOMADEE_API_URL` | não | default `https://api.lomadee.com.br` |
| `LOMADEE_PRODUCTS` | não | `=1` importa catálogo `/affiliate/products` **no sync manual** (`scripts/sync.ts`) |
| `FEED_URL` | alternativa* | Feed XML/JSON genérico se não houver API key (somente sync manual) |
| `NEXT_PUBLIC_SITE_URL` | recomendado | URL canônica (default `http://localhost:3000`) — afeta sitemap/canonical/OG |
| `VERCEL_URL` | automático | fallback de `siteUrl()` quando `NEXT_PUBLIC_SITE_URL` não existe |
| `AFFILIATE_URL_OVERRIDE` | não | sobrescreve `affiliateUrl` no sync manual (testes) |

\* O sync **incremental** (`src/lib/syncer.ts`) só funciona com `LOMADEE_API_KEY`; `FEED_URL` é usado apenas por `npm run sync`. Atenção: a fase `products` do syncer roda sempre que houver `AffiliatedOrg` — ela **não** consulta `LOMADEE_PRODUCTS`.

Na Vercel essas vars estão configuradas no projeto `ofertacoradar` (time `tisomars-projects`).

---

## Comandos

```bash
npm run dev        # dev server (Turbopack)
npm run build      # build de produção
npm run start      # serve o build
npm run lint       # ESLint
npm run sync       # sync completo/manual via scripts/sync.ts (tsx --env-file=.env)
npm run db:push    # prisma db push (migrations ad-hoc)
npx tsc --noEmit   # typecheck
```

`npm install` / deploy já roda `prisma generate` via `postinstall`.

> `npm run db:push` pode travar no pooler do Supabase; alternativa: `ALTER TABLE` manual via `prisma.$executeRawUnsafe`.

Deploy manual:

```bash
npx vercel --prod --yes   # publica em ofertacoradar.vercel.app
```

---

## Estrutura

```
src/
  app/
    page.tsx                    # home: hero/stats/lojas, carrossel, relâmpago,
                                # aproveitadas, categorias, grid, filtros, paginação
    produto/[id]/page.tsx       # detalhe: preço, cupom, countdown, prova social,
                                # share, imagens p/ feed/story, relacionados, JSON-LD
    ir/[id]/route.ts            # redirect de afiliado + registro de clique
    api/card/[id]/route.tsx     # PNG social (feed/story) via next/og
    sitemap.ts / robots.ts / layout.tsx / loading.tsx / not-found.tsx
    globals.css / favicon.ico
  components/                   # ProductCard, FeaturedCarousel, CountdownTimer,
                                # CategoryNav, SearchBar, ShareButtons, BackButton,
                                # CopyCoupon, ThemeToggle, Icons
  lib/
    db.ts                       # Prisma client (singleton p/ dev)
    feed.ts                     # fetch/normalização Lomadee API + feed XML/JSON
    syncer.ts                   # sync incremental via tráfego
    categories.ts               # categorias canônicas + classificador
    format.ts / urgency.ts / site.ts / shortener.ts
scripts/
  sync.ts                       # sync completo/manual
  _backfill.ts                  # backfill categoria/merchant (uso único)
prisma/schema.prisma
```

---

## Sync de dados

### Incremental (`src/lib/syncer.ts`)

- Disparado por `after()` na home e na página de produto — roda em background **depois** da resposta, sem atrasar o usuário.
- Só funciona com `LOMADEE_API_KEY` (ignora `FEED_URL`).
- Fases: `brands → campaigns → products`.
- **Budget** de 45s por invocação; ciclo completo a cada **30min** (`lastCycleAt`); lock anti-corrida com `busyAt` (expira em 3min se o worker morrer).
- `brands`: upserta `Brand` página a página e, ao terminar, limpa `AffiliatedOrg` para reconstruir no ciclo.
- `campaigns`: upserta ofertas `camp:*` com imagem (`status=onTime`, `channels[].shortUrls[0]` → `affiliateUrl`) e popula `AffiliatedOrg`; páginas com falha são puladas (até 30 falhas consecutivas encerram a fase).
- `products`: lê `/affiliate/products` e grava apenas itens de `organizationId` presente em `AffiliatedOrg`, com `imageUrl` e `price !== 0`; salva como `prod:*`, **sem** `affiliateUrl` (link comissionado é gerado no clique).
- Não desativa itens que sumiram da fonte (upsert apenas).

### Manual (`scripts/sync.ts` → `npm run sync`)

- Requer `DATABASE_URL` + `LOMADEE_API_KEY` **ou** `FEED_URL`.
- Com API key: importa **campanhas** sempre; importa catálogo `/affiliate/products` somente se `LOMADEE_PRODUCTS=1` (limitado a orgs afiliadas e `price !== 0`).
- Com `FEED_URL`: parse tolerante de XML/JSON genérico (title/name, price/preco, link/url, image/imagem etc.).
- Upsert por `externalId` (ou `url` quando não há id), em paralelo (concorrência 5).
- Ao final, **desativa** produtos ausentes da fonte (feed/API = fonte da verdade).
- `AFFILIATE_URL_OVERRIDE` sobrescreve `affiliateUrl` de todos os itens nesse modo.

### Prioridade de fontes

`LOMADEE_API_KEY` tem precedência sobre `FEED_URL` no sync manual. O sync incremental existe apenas para a API Lomadee.

---

## Notas de API Lomadee

- Rate limit **60 req/min**; sleeps de ~300ms entre páginas; `lomadeeGet` tenta até 6x com backoff em 429/5xx e respeita `Retry-After`.
- 500 intermitente em algumas páginas: sync pula a página e segue (campanhas abortam após 30 falhas consecutivas).
- Paginação: campaigns/orders usam `meta`, brands usa `pagination`, products usa `count`; limit típico 20–100.
- Campanhas exibíveis exigem `status === "onTime"` e `channels[].shortUrls[0]`; `period.endAt` → `endsAt`; `mediaKit.banners[0]` ou logo da marca → `imageUrl`; `code` → `couponCode`.
- Produtos do catálogo **não** trazem `brands` nem link comissionado — merchant vem de `AffiliatedOrg` (fallback) e o link é gerado no clique via shortener.
- Shortener: `POST /affiliate/shortener/url` com `{ type: "Custom", url, organizationId }` retorna array com `shortUrls[]`; cache em `TrackedLink` por `sourceUrl`.

---

## Roadmap sugerido

- [ ] Reconciliar conversões via API `/orders` (cliques → vendas → receita real por loja)
- [ ] Páginas `/categoria/[slug]` e `/lojas` indexáveis (SEO)
- [ ] Usar `/api/card/[id]` como `og:image`/Twitter image automático nas páginas de produto
- [ ] Desativar/expirar itens ausentes também no sync incremental
- [ ] `vercel git connect` quando houver acesso de escrita ao repo `synapsecodeonline/ofertaco`
