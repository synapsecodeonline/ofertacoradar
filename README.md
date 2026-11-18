# Ofertaço 🏷️

Site brasileiro de **cupons, ofertas e produtos com links de afiliado Lomadee e Mercado Livre**. Vitine de descontos com foco em SEO, conversão e monetização via comissões de afiliado.

**Produção:** https://ofertacoradar.vercel.app · **Instagram:** https://instagram.com/ofertacoradar

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
| `/` | página | Redirect 307 → `/ofertas-do-dia` (preserva query). |
| `/ofertas-do-dia` | página | Home dinâmica: modo **dia** (sem params) = ofertas do dia (Terminando em breve + Ranking do dia); modo **catálogo** (`?aba=lojas|ml|awin`) = cabeçalho por fonte + busca + seção Ofertas da fonte + lojas em destaque + categorias + ordenação + grid paginado. O catálogo **nunca mistura fontes**: Lomadee=`camp-lomadee:`+`prod-lomadee:`, Mercado Livre=`ml:`, Awin=`aw:`. |
| `/produto/[id]` | página | Detalhe do item: preço, cupom, countdown, prova social, relacionados, share e JSON-LD. |
| `/ofertas-do-dia` | página | Curadoria diária: terminando em breve, mais aproveitadas (24h) e maiores descontos. Indexável, no sitemap. |
| `/api/instagram/kit` | route handler | Kit de conteúdo p/ Instagram (login obrigatório): top produtos ranqueados por cliques 24h + desconto, com `cardUrl` (`/api/card`), `pageUrl` e `caption` prontos. `?count=` (máx 20) e `?size=feed|story`. |
| `/ir/[id]` | route handler | Redirect 302 para a loja/oferta, registrando `Click`. Suporta `?src=` → `utm_source` no destino final. |
| `/api/card/[id]` | route handler | PNG de divulgação via `next/og`: `?size=feed` (1080×1080, default) ou `?size=story` (1080×1920). |
| `/sitemap.xml` | metadata route | Home + até 5.000 produtos ativos. |
| `/robots.txt` | metadata route | Libera tudo exceto `/ir/`; aponta para o sitemap. |

### `/ir/[id]` em detalhe

1. Busca o `Product` ativo; se não existir, redireciona para `/`.
2. Cria um `Click` assíncrono com `referer` e `userAgent` (truncado em 500 chars).
3. Se o produto **não** tiver `affiliateUrl` mas tiver `organizationId` (catálogo `prod-lomadee:*`), chama `POST /affiliate/shortener/url`, cacheia em `TrackedLink` e redireciona para o `lmdee.link` gerado; se falhar, cai na `url` direta.
4. Caso contrário, redireciona para `affiliateUrl ?? url`; `?src=...` vira `utm_source` na URL de destino.

---

## Funcionalidades

### Monetização / Afiliados

- **Ofertas/cupons** (`externalId` `camp-lomadee:*`): campanhas Lomadee com link `lmdee.link` já rastreado — comissão por conversão.
- **Catálogo de produtos** (`prod-lomadee:*`): produtos de lojas afiliadas; o link comissionado é gerado **no clique** via `POST /affiliate/shortener/url` e cacheado em `TrackedLink`.
- **Mercado Livre** (`ml:*`): produtos do catálogo ML (API `/products/search` + buy-box winner). Comissão pelo **programa de afiliados próprio do ML** (independente da Lomadee): com `ML_AFFILIATE_TOOL`+`ML_AFFILIATE_WORD` configurados, `/ir/` redireciona para a página de catálogo `/p/MLB{id}` com `matt_tool`/`matt_word` — até 16% conforme categoria, pago via Mercado Pago. Sem as vars, cai no link direto (sem comissão).
- `/ir/[id]` é o **único caminho de saída** para lojas e registra `Click` sem bloquear o redirect. Produtos `ml:*` têm `organizationId = null` (nunca passam pelo shortener Lomadee); a monetização é exclusiva do programa de afiliados do ML via `matt_tool`/`matt_word`.
- Disclosure de afiliado no footer, na página do produto, nos CTAs e na seção "Por que confiar" da home.

### UX / Conversão

- **Hero** com estatísticas reais (produtos, ofertas e lojas), chips de lojas parceiras com logo/nome e carrossel de **ofertas em destaque** (top 5 por desconto da aba/filtros atuais, troca a cada 6s, pausa no hover, setas e dots).
- **Telas por fonte de afiliado** (`?aba=`): `lojas` (**Lomadee** — seção Ofertas `camp-lomadee:*` + catálogo `prod-lomadee:*`), `ml` (**Mercado Livre** — ofertas com desconto + catálogo `ml:*`) e `awin` (**Awin** — `aw:*`, só renderiza com itens). O catálogo **nunca mistura fontes** — cada tela tem sua seção de ofertas, grid, filtros e facetas. A antiga aba `ofertas` foi removida: `?aba=ofertas`/`aba=produtos` → `lojas` (ou `ml`/`awin` conforme `?fonte=`).
- **Navegação para o catálogo**: `qs()` sempre anexa `#catalogo` e todo link de filtro (abas por fonte no header e na página, ordenação, categorias, subtipos, paginação, lojas em destaque, busca) passa pelo client `HashLink`/`markScrollTo`. O clique só grava uma flag em `sessionStorage` e o `CatalogScrollOnNav` (montado na home) rola até o elemento **depois** que a navegação comita — o reset de scroll do App Router não apaga mais a rolagem. Flag expira em 15s.
- **Busca** (`?q=`) em título, descrição e merchant; **filtro de loja** (`?loja=`, merchant case-insensitive); **categoria** (`?categoria=` canônica, casando slugs legados no banco).
- A separação por fonte é **estrutural** (abas), não visual — por isso não há badge de origem nos cards.
- **Ordenações** (`?ordem=`): `desconto` (default em Ofertas), `recentes` (default em Produtos), `terminando` e `populares` (por total de cliques). A barra de ordenação fica entre **Categorias** e o **Catálogo**. Filtros, busca, loja e ordenação viram query params; mudanças resetam `pagina`.
- **Paginação** em todas as abas: 48 itens/página (`pagina`).
- Itens exibidos exigem `active`, `imageUrl`, preço diferente de 0 quando informado e `endsAt` nulo ou futuro.
- **"Destaques do momento"**: seção retrátil única com dois trilhos **escopados na fonte da aba** — **"Terminando em breve"** (`endsAt` entre agora e +48h, até 12, countdown ao vivo, cupom quando houver) e **"Mais clicadas nas últimas 48h"** (até 12 candidatos filtrados pela fonte, badge de cliques; fallback para maiores descontos da fonte quando não há cliques). Respeita `q`/`categoria`/`loja`; esses itens são removidos do grid principal para não duplicar. Ambos usam o componente `RailCard` compartilhado.
- **Cards de produto** exibem logo da loja (resolvido por `merchantLogo`: lista de destaque → `Brand.name` → favicon do domínio), selo de origem `ML`/`AW` para fontes não-Lomadee, badge de desconto, cupom, urgência e prova social de cliques dos últimos 30 dias quando ≥ 3.
- **Home canônica = `/ofertas-do-dia`**: o domínio `/` redireciona (307, via `src/proxy.ts`) preservando query params. A página tem dois modos: **sem params de catálogo** = só as ofertas do dia (Terminando em breve, Mais aproveitadas 24h, Ranking do dia em grade, Instagram); **com `?aba=`/`?loja=`/filtros** = visão completa de catálogo: cabeçalho claro com título da fonte + busca (sem abas — a troca de fonte fica no menu do site), **seção "Ofertas {Fonte}"** (`camp-lomadee:` na Lomadee; itens com `discountPct>0` em ML/Awin), lojas em destaque, categorias, ordenação e grade. A aba `ofertas` foi removida — `?aba=ofertas` legado cai em `lojas`. Ambos seguidos do `HomeExperience` (`src/components/HomeExperience.tsx`, extraído de `page.tsx`) com `dayOnly` — em modo catálogo mostra cabeçalho da fonte + busca, seção Ofertas da fonte, lojas em destaque, categorias, ordenação e grade; em modo dia (`dayOnly`) renderiza apenas Instagram + transparência.
- **"Lojas em destaque"**: carrossel **por tela** — Lojas Lomadee mostra lojas com `camp-lomadee:`+`prod-lomadee:` (rede Lomadee inteira), ML só `ml:`, Awin só `aw:`. O card mostra **"X ofertas · Y produtos"** (partes zeradas ocultas). Clicar numa loja filtra a tela daquela fonte (`?aba=X&loja=Y`).
- **Banner Instagram**: CTA "Ofertas do dia em vídeo" com link para `NEXT_PUBLIC_INSTAGRAM_URL` (default `instagram.com/ofertacoradar`).
- **Seção "Por que confiar no Ofertaço Radar"**: 4 cards de transparência (preços atualizados, compra na loja oficial, só ofertas reais, aviso de afiliado).
- Página de produto: breadcrumb, imagem, badges `-%`, cupom copiável, **"Economize R$ X"**, countdown real (<7 dias), lista **"Por que aproveitar agora"** (desconto, economia, cupom, urgência, loja e cliques), selos de confiança, **"como usar o cupom"**, relacionados (mesma loja primeiro, depois mesma categoria), botões **WhatsApp / Copiar link**, botões **"Imagem p/ feed" / "Imagem p/ story"** (`/api/card`) e **CTA fixo no mobile**.
- Botão **Voltar** (`router.back()` com fallback) na página de produto.
- Tema claro/escuro manual (`ThemeToggle`, `localStorage["theme"]`); script inline aplica o tema salvo antes do paint e usa `prefers-color-scheme` quando não há preferência salva.
- Barra de **categorias** em painel expansível animado: abre no load/topo, fecha ao descer (>160px), reabre no topo, sticky, grid de tiles com avatar colorido por hash do slug; fecha com Esc/clique fora.

### Categorias

- Conjunto canônico de **34 categorias** em PT-BR (`src/lib/categories.ts`). Classificador por palavras-chave do título com fronteiras unicode-aware (`(?<![\p{L}\p{N}_])` — `\b` do JS não reconhece letras acentuadas e classificava 'Bebê'/'Sutiã' errado); prioridade: sinal forte do título → `merchantCategory` → palavra do título → `segment` Lomadee → categoria crua → `outros`.
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
- **Performance da home**: todas as queries independentes rodam num único `Promise.all` (~11 paralelas); merchants×fonte vêm de uma `$queryRaw` com `COUNT(*) FILTER` (1 query em vez de 4); `heroStores` é derivado de `brandRows` sem query extra. Cada roundtrip ao pooler custa ~800ms — paralelizar e reduzir queries é o que mantém a home rápida. Sync usa `syncPrisma` (pool separado, ver AGENTS.md).
- `loading.tsx` (skeleton de cards) e `not-found.tsx` em pt-BR.

---

## Modelo de dados (`prisma/schema.prisma`)

- **Product** — ofertas e produtos: `externalId` (`camp-lomadee:`/`prod-lomadee:` Lomadee, `ml:` Mercado Livre, `aw:` Awin — unique), `title`, `description`, `imageUrl`, `price`/`oldPrice`/`discountPct`, `currency` (default `BRL`), `category`, `merchant`, `organizationId`, `url`, `affiliateUrl`, `couponCode`, `endsAt`, `active`, timestamps; índices em `category` e `active`; relação `clicks`.
- **Click** — cliques em `/ir/[id]`: `productId`, `referer`, `userAgent`, `createdAt`; índice em `productId`.
- **TrackedLink** — cache `sourceUrl → shortUrl` do shortener (`organizationId`, `createdAt`).
- **AffiliatedOrg** — organizações afiliadas vistas nas campanhas (`organizationId`, `name`); base para filtrar o catálogo e fallback de merchant.
- **Brand** — marcas Lomadee (`id` = organizationId, `name`, `logo`, `site`).
- **SyncState** — estado do sync incremental: `key`, `phase`, `page`, `lastCycleAt`, `busyAt`, `orgsCleared`. Chaves: `main` (Lomadee), `ml` (Mercado Livre) e `ml-token` (`phase` = JSON com access/refresh tokens OAuth).

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
| `ML_CLIENT_ID` | não | Client ID do app Mercado Livre — habilita sync ML |
| `ML_CLIENT_SECRET` | não | Secret Key do app Mercado Livre |
| `ML_AUTH_SECRET` | não | protege `/api/ml-auth/start` e valida o `state` do OAuth |
| `ML_AFFILIATE_TOOL` | não | `matt_tool` do programa Afiliados e Criadores do ML — habilita comissão em `ml:*` |
| `ML_AFFILIATE_WORD` | não | `matt_word` (etiqueta) do afiliado ML — vai junto do `matt_tool` no redirect |
| `NEXT_PUBLIC_INSTAGRAM_URL` | não | link do Instagram (default `https://instagram.com/ofertacoradar`) |

\* O sync **incremental** (`src/lib/syncer.ts`) só funciona com `LOMADEE_API_KEY`; `FEED_URL` é usado apenas por `npm run sync`. Atenção: a fase `products` do syncer roda sempre que houver `AffiliatedOrg` — ela **não** consulta `LOMADEE_PRODUCTS`.

### Mercado Livre (`src/lib/mercadolivre.ts`)

- **Auth OAuth2 + PKCE**: bootstrap web via `GET /api/ml-auth/start?key=$ML_AUTH_SECRET` → autorização no ML → `GET /api/ml-auth/callback` troca o `code` (com `code_verifier`) e grava tokens no `SyncState` key `ml-token` (`phase` = JSON). Access token ~6h, refresh token ~6 meses — o syncer renova sozinho.
- **Busca**: `/sites/{site}/search` foi **descontinuado pelo ML** (403 global). Usamos a API de catálogo: `GET /products/search?site_id=MLB&status=active&q=...` → `GET /products/{id}/items?limit=1` (vencedor da buy box, preço + `original_price`) → URL do anúncio via formato curto `produto.mercadolivre.com.br/MLB-{item_id}`. `/items/{id}` é restrito a itens do próprio usuário (403) — por isso a URL é montada.
- **Sync independente**: `SyncState` key `ml`, fases `q:{índice da query}` + `page`=offset, mesmas regras do Lomadee (budget 45s, TTL 30min, lock 3min). `ML_QUERIES` cobre ~54 termos; `ML_LIMIT=30` por página, até offset 200 por query.
- Desativação no sync manual é **por fonte**: `ml:*` só é desativado quando o ML rodou naquela execução, e nunca afeta `camp-lomadee:`/`prod-lomadee:`/feed.
- **Afiliado ML** (programa "Afiliados e Criadores", até 16% por categoria, pagamento via Mercado Pago a partir de R$30): gere um link no portal `mercadolivre.com.br/afiliados/linkbuilder`, copie os valores de `matt_tool` e `matt_word` do link gerado e configure `ML_AFFILIATE_TOOL`/`ML_AFFILIATE_WORD` na Vercel. Todo link de afiliado ML é a URL do produto + esses dois parâmetros.

Na Vercel essas vars estão configuradas no projeto `ofertacoradar` (time `synapse-code1`).

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
    page.tsx                    # home: hero/stats/lojas, carrossel, abas, busca,
                                # ordenação, filtro por fonte, "Destaques do momento"
                                # (RailCard compartilhado), lojas em destaque,
                                # categorias, grid, paginação, Instagram, transparência
    produto/[id]/page.tsx       # detalhe: preço, cupom, countdown, prova social,
                                # share, imagens p/ feed/story, relacionados, JSON-LD
    ir/[id]/route.ts            # redirect de afiliado + registro de clique
    api/card/[id]/route.tsx     # PNG social (feed/story) via next/og
    api/ml-auth/start|callback  # OAuth do Mercado Livre (uso único/manual)
    sitemap.ts / robots.ts / layout.tsx / loading.tsx / not-found.tsx
    globals.css / favicon.ico
  components/                   # ProductCard, FeaturedCarousel, CountdownTimer,
                                # CategoryNav, SearchBar, ShareButtons, BackButton,
                                # CopyCoupon, ThemeToggle, Icons
  lib/
    db.ts                       # Prisma client (singleton p/ dev)
    feed.ts                     # fetch/normalização Lomadee API + feed XML/JSON
    mercadolivre.ts             # OAuth ML + busca catálogo + normalização ml:*
    syncer.ts                   # sync incremental via tráfego (main + ml)
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
- Duas fontes independentes: `maybeSyncLomadee()` (Lomadee, exige `LOMADEE_API_KEY`) e `maybeSyncML()` (Mercado Livre, exige `ML_CLIENT_ID`+`ML_CLIENT_SECRET`).
- Lomadee — fases: `brands → campaigns → products`.
- Mercado Livre — fases: `q:{query}` com `page`=offset sobre `ML_QUERIES`; cada página busca catálogo + vencedor de buy box (~10-19s/página).
- **Budget** de 45s por invocação; ciclo completo a cada **30min** (`lastCycleAt`); lock anti-corrida com `busyAt` (expira em 3min se o worker morrer).
- `brands`: upserta `Brand` página a página e, ao terminar, limpa `AffiliatedOrg` para reconstruir no ciclo.
- `campaigns`: upserta ofertas `camp-lomadee:*` com imagem (`status=onTime`, `channels[].shortUrls[0]` → `affiliateUrl`) e popula `AffiliatedOrg`; páginas com falha são puladas (até 30 falhas consecutivas encerram a fase).
- `products`: lê `/affiliate/products` e grava apenas itens de `organizationId` presente em `AffiliatedOrg`, com `imageUrl` e `price !== 0`; salva como `prod-lomadee:*`, **sem** `affiliateUrl` (link comissionado é gerado no clique).
- Não desativa itens que sumiram da fonte (upsert apenas).

### Manual (`scripts/sync.ts` → `npm run sync`)

- Requer `DATABASE_URL` + `LOMADEE_API_KEY` **ou** `FEED_URL`.
- Com API key: importa **campanhas** sempre; importa catálogo `/affiliate/products` somente se `LOMADEE_PRODUCTS=1` (limitado a orgs afiliadas e `price !== 0`).
- Com `ML_CLIENT_ID`+`ML_CLIENT_SECRET`: adiciona produtos do catálogo ML (`ml:*`, até 4 páginas por query de `ML_QUERIES`).
- Com `FEED_URL`: parse tolerante de XML/JSON genérico (title/name, price/preco, link/url, image/imagem etc.).
- Upsert por `externalId` (ou `url` quando não há id), em paralelo (concorrência 5).
- Ao final, **desativa** produtos ausentes da fonte — por prefixo: Lomadee/feed só desativa itens não-`ml:`, ML só desativa `ml:*` ausentes (e somente se o ML rodou na execução).
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
