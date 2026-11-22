# Ofertaço Radar 🏷️

Agregador brasileiro de **ofertas, cupons e produtos com links de afiliado** — Lomadee, Mercado Livre, Awin e Amazon. Catálogo ranqueado por desconto, com verificação contínua de disponibilidade, link e imagem. Foco em SEO, conversão e monetização via comissões.

**Produção:** https://ofertacoradar.com.br · **Instagram:** https://instagram.com/ofertacoradar

Além do site, o projeto gera automaticamente um **kit diário de divulgação para o Instagram** (reel + cards + legenda) enviado por email — ver seção dedicada abaixo.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, `cacheComponents` off) |
| UI | React 19 + Tailwind CSS 4 |
| Banco | PostgreSQL (Supabase) via Prisma 6 (`prisma-client-js`) |
| Auth | Supabase Auth (somente `/admin` e `/login`) |
| Deploy | Vercel |
| Sync 24/7 | cron-job.org → `GET /api/cron/sync?key=$CRON_SECRET` a cada 1min |
| Rotinas agendadas | **cron-job.org → GitHub Actions** (grátis): kit diário 8h BRT + recategorização dom 6h BRT — ver `.github/workflows/` |
| Saúde das rotinas | healthchecks.io (`KIT_HEALTHCHECK_URL`) — alerta se o kit não rodar |
| Parser de feed | `fast-xml-parser` |
| Vídeo do kit | `ffmpeg-static` (reel 1080×1920 com xfade, Ken Burns, gradiente, legendas ASS) |
| Email do kit | Resend API (`RESEND_API_KEY`) — domínio verificado `kit@ofertacoradar.com.br` |
| Imagens sociais | `next/og` (`ImageResponse`) — `/api/card/[id]` e `/api/og` |
| APIs externas | Lomadee, Mercado Livre (OAuth2), Amazon PA-API 5.0 (SigV4), SerpApi |
| Analytics | GA4 (`NEXT_PUBLIC_GA_ID`) |
| Scripts | `tsx` |
| Fontes | Geist via `next/font`; Inter sob demanda nas imagens |

> ⚠️ Este projeto usa uma versão **não padrão** do Next.js. Antes de codar, consulte `node_modules/next/dist/docs/` e o bloco em `AGENTS.md`.

---

## Setup local

```bash
npm install          # também roda `prisma generate` no postinstall
# crie o .env com DATABASE_URL + chaves das fontes (ver seção de variáveis)
npm run db:push      # aplica o schema no Postgres (pode falhar no pooler — ver nota)
npm run sync         # opcional: sync manual via scripts/sync.ts
npm run dev          # http://localhost:3000
```

---

## Infraestrutura e serviços externos

| Serviço | Papel |
|---|---|
| **Vercel** | Hosting do Next.js + endpoint `/api/cron/sync` |
| **Supabase** | PostgreSQL (Product, Click, ScriptState…) + Auth `/admin` |
| **GitHub Actions** | Executa kit diário e recategorização (grátis) |
| **cron-job.org** | Gatilhos: sync a cada 1min + dispatch dos workflows no horário exato |
| **Resend** | Email do kit — `kit@ofertacoradar.com.br` (domínio verificado) |
| **healthchecks.io** | Dead-man's switch do kit (alerta se não pingar) |
| **Search Console / Merchant Center / GA4** | SEO, Google Shopping feed, analytics |
| **Lomadee / Mercado Livre / Awin / Amazon / SerpApi** | Fontes de afiliado e dados de produto |

**O que roda local:** apenas o scrape Amazon 7h — agora em **Docker**
(`deploy/amazon/`, IP residencial pois a Amazon bloqueia datacenter) —
o **Chatwoot self-hosted** (`deploy/chatwoot/`, WSL2 + Docker, exposto
via cloudflared) e o ambiente de dev (`npm run dev`). Todo o resto é
nuvem.

---

## Rotas e endpoints

| Rota | Tipo | Descrição |
|---|---|---|
| `/` | página | **O catálogo** — duas abas: `Produtos` (padrão, catálogo unificado de produtos e ofertas de **todas** as fontes, intercalado por fonte (cada fonte contribui seus maiores descontos por rodada — Amazon/Awin não afundam no ranking)) e `?aba=cupons` (todo item de cupom/oferta — `couponCode` de qualquer fonte + campanhas `camp-lomadee:`, ordenados por expiração). Busca, categorias, subtipos e grid paginado. URLs antigas `?aba=lomadee\|ml\|awin\|amazon\|produtos\|ofertas\|lojas` e `?fonte=` convergem para a aba Produtos. |
| `/cupons` | route handler | Redirect 302 → `/?aba=cupons` (a página de cupons virou aba da home; redirect preserva links/SEO antigos). |
| `/produto/[id]` | página | Detalhe: preço, cupom copiável, countdown, prova social, relacionados, share, JSON-LD `Product`+`BreadcrumbList`. Dispara sync em `after()`. |
| `/ir/[id]` | route handler | Redirect 302 para a loja **registrando clique** (pulando admin logado e bots). `?src=` → `utm_source`. Por fonte: `ml:` → `matt_tool`/`matt_word`; `amz:` → força `?tag=`; `prod-lomadee:` sem affiliateUrl → shortener `lmdee.link`. |
| `/admin` | página | Painel restrito a logados (Supabase): KPIs, gráficos, status de sync por fonte com erros, produtos sem imagem, botão "Sincronizar agora" (todas as fontes), **formulário de cadastro manual Amazon**, export CSV. Auto-refresh (15s durante sync, 60s ocioso). |
| `/login` | página | Login Supabase (email/senha) — único acesso ao `/admin`. |
| `/api/pv` | route handler | Pageviews do `PageViewTracker` → `Click` no produto sentinela `internal:pageview`. Ignora bots (`isBot`) e admin logado (cookie + `supabase.auth.getUser()`). |
| `/api/admin/sync` | route handler | POST (login): inicia sync de **todas** as fontes configuradas; retorna status por fonte e roda em `after()`. |
| `/api/admin/amz` | route handler | POST (login): `action=lookup` (metadados via SerpApi/scrape) e `action=add` (cadastra `amz:{ASIN}`). |
| `/api/admin/export` | route handler | GET (login): CSV dos cliques dos últimos 30 dias. |
| `/api/card/[id]` | route handler | PNG de divulgação (login): `?size=feed` (1080×1080) ou `?size=story` (1080×1920). |
| `/api/og` | route handler | OG image padrão 1200×630 com a marca — usada como `og:image`/Twitter image global. |
| `/api/cron/sync` | route handler | `?key=$CRON_SECRET` — ping do cron-job.org; dispara `maybeSync*` em `after()`. |
| `/api/ml-auth/start\|callback` | route handlers | OAuth do Mercado Livre (bootstrap manual). |
| `/api/health` | route handler | Health check `{ok:true}`. |
| `/api/instagram/kit` | route handler | Kit de conteúdo Instagram (login): top produtos + `cardUrl` + caption. |
| `/ofertas` | página | **Link-in-bio** estilo Linktree: perfil, provas sociais ao vivo (ofertas ativas + última sync), links rápidos, "terminando em 24h", categorias e destaques. |
| `/feed/google.xml` | route handler | Feed **Google Shopping** (RSS 2.0 + namespace `g:`): ~21k produtos, `price`/`sale_price` corretos, `brand` extraída do título (`src/lib/brands.ts`), links canônicos. Configurado no Merchant Center com busca programada diária. |
| `/sitemap.xml` | metadata route | **Índice** de sitemaps: `/sitemaps/pages` (rotas estáticas + categorias) + `/sitemaps/produtos/[page]` (1.000 URLs/produto cada). |
| `/robots.txt` | metadata route | Libera tudo exceto `/ir/`; aponta para o sitemap. |

### `/ir/[id]` em detalhe

1. Busca `Product` ativo; senão → `/`.
2. Em `after()`: pula bots (`isBot`) e admin logado (sessão Supabase validada de verdade), senão grava `Click`.
3. `ml:*` → página de catálogo `/p/{id}` com `matt_tool`/`matt_word` (comissão no programa ML).
4. `amz:*` → URL do produto com `?tag=$AMZ_TAG` forçado.
5. `prod-lomadee:*` sem `affiliateUrl` → `POST /affiliate/shortener/url` (cache `TrackedLink`).
6. Demais → `affiliateUrl ?? url`; `?src=` vira `utm_source`.

---

## Fontes de afiliado

Prefixo em `Product.externalId` define a fonte (`src/lib/sources.ts`):

| Prefixo | Fonte | Comissão |
|---|---|---|
| `camp-lomadee:` | Cupons/ofertas Lomadee | `lmdee.link` já rastreado |
| `prod-lomadee:` | Catálogo de produtos Lomadee | shortener `lmdee.link` no clique |
| `ml:` | Mercado Livre (catálogo oficial) | `matt_tool`/`matt_word` no redirect |
| `aw:` | Awin | deep link `awin1.com` do feed ou montado com `AWIN_AFFID` |
| `amz:` | Amazon Associates | `?tag=$AMZ_TAG` no redirect |

- **Lomadee** (`src/lib/syncer.ts` + `src/lib/feed.ts`): campanhas (`status=onTime`) + catálogo de produtos de orgs afiliadas; rate limit 60 req/min; validação contínua de **link + imagem**.
- **Mercado Livre** (`src/lib/mercadolivre.ts` + `src/lib/syncer.ts`): OAuth2+PKCE com refresh automático; catálogo via `/products/search` + buy-box winner (a busca `/sites/search` foi descontinuada pelo ML).
- **Amazon** (`src/lib/amazon.ts`): PA-API 5.0 com assinatura **AWS SigV4** (`SearchItems` por keywords) quando `AMZ_API_KEY`/`AMZ_API_SECRET` existem; sem credenciais, três caminhos de cadastro: **manual** via `/admin` (lookup por SerpApi ou scrape), **scraper local** (`scripts/amz-scrape.ts`, ver abaixo) e PA-API quando liberada.
- **Awin** (`src/lib/awin.ts`): sincronizador de **product datafeeds** — a Awin não tem API pública de catálogo; cada anunciante aprovado disponibiliza um feed (CSV/XML/JSON). Configure `AWIN_FEEDS` + `AWIN_AFFID` (ver tabela de env) e os produtos entram como `aw:` automaticamente — rastreados por deep link quando o feed traz `aw_deep_link` ou quando `awinmid`+`AWIN_AFFID` permitem montar o `cread.php`.

### Bloqueios ativos

- `BLOCKED_URL_PARTS`/`BLOCKED_MERCHANTS` em `upsert.ts`: **Rovitex** bloqueada (catálogo Lomadee desatualizado, links quebrados) até o usuário liberar.
- `BLOCKED_IMAGE_HOSTS`: `vestis.vteximg.com.br` e `shopinfo.vteximg.com.br` (contas VTEX inativas) — produto com imagem desses hosts nem entra no banco.

---

## Kit diário do Instagram (`scripts/daily-kit.ts`)

Automação completa de divulgação: todo dia **08:00** o cron-job.org
chama a API do GitHub (`workflow_dispatch`) e o workflow
`.github/workflows/kit.yml` roda `npm run kit:daily` no GitHub
Actions, enviando um email com tudo pronto para postar.

> ⚠️ O `schedule:` do próprio GitHub **não é confiável em conta
> free** (execuções atrasam ou são puladas). O gatilho oficial é o
> cron-job.org — o schedule do workflow fica só como backup.
> Healthcheck em healthchecks.io alerta se o run não acontecer.

### Cronograma semanal de temas

| Dia | Tema | Categorias |
|---|---|---|
| Segunda | TECH & ELETRÔNICOS | eletronicos, celulares, informatica, games, tv-audio, fotografia, software |
| Terça | CASA & DECORAÇÃO | casa-decoracao, decoracao, iluminacao, textil-cama, moveis, cozinha, eletro* |
| Quarta | BELEZA & CUIDADOS | beleza, maquiagem, skincare, cabelo, perfumaria, saude, suplementos |
| Quinta | MODA & ESTILO | moda-*, calcados*, bolsas-mochilas, acessorios-moda, oculos, joias, lingerie |
| Sexta | ESPORTE & FITNESS | esporte-lazer, fitness, ciclismo, camping, esporte-infantil |
| Sábado | MERCADO & LAR | supermercado, mercearia, limpeza-higiene, alimentos, pets, bebe, brinquedos |
| Domingo | ACHADINHOS & SURPRESAS | ofertas (maiores descontos) |

### Conteúdo gerado

- **Reel MP4** 1080×1920@30fps (~21s): intro com logo (`assets/logo.jpeg`)
  + tema do dia, um clip por produto usando **o mesmo card story**
  enviado no email (vídeo e imagem sempre condizentes), outro com CTA.
  Efeitos: degradê teal animado (`gradients`), Ken Burns, vinheta, grão,
  transições `xfade` fade 0.5s, barra de progresso verde, fonte
  **Ubuntu Sans** (ASS).
- **Cards PNG** feed 1080×1080 e story 1080×1920 via `/api/card/[id]`.
- **Email** = guia do dia: cronograma de postagem (12h reel, stories
  15/18/21h, 20h feed), cards por produto com link da página e **uma
  legenda combinada** cobrindo todos os itens (reel/feed exibem todos;
  story não tem legenda).
- `kit-out/` guarda cópia local de tudo (gitignored) + `audit-*.json`
  (memória de enviados fica em `ScriptState`/`kit-sent` no banco).

### Regras de seleção (o que garante qualidade)

1. **Categoria canônica** (`src/lib/categories.ts`) ∈ tema do dia.
2. **Título confirma o tema** (regex por tema) — falso positivo do
   classificador não entra.
3. **Veto de substantivo-produto** (esporte): "pijama de basquete" é
   roupa, não esporte — o objeto vendido manda.
4. **Desconto ≥ 10%** (`MIN_DISC`) — markdown de 3-5% não é oferta.
5. **Sem repetição**: IDs e famílias (`familyKey`) enviados nos últimos
   14 dias são excluídos — persistido em **`ScriptState` (banco,
   key `kit-sent`)** porque o Actions é efêmero; `kit-out/sent.json`
   local é só fallback/migração. Janela relaxa 14→7→3 se o tema
   tiver <2 ofertas frescas. Fallback honesto: tema vazio →
   "achadinhos" com aviso no email. Embaralho dentro do top-14 por
   score (cliques 7d ×3 + marca conhecida +80 + loja conhecida +25 +
   desconto) para variar sem perder qualidade.
6. **Família dedup**: variações de cor/tamanho do mesmo produto viram 1.
7. **Auditoria**: cada run grava `kit-out/audit-AAAA-MM-DD.json` com
   score, cliques, boosts e janela de exclusão de cada item —
   responde "por que saiu isso?" sem consultar o banco.

### Áudio do reel (à prova de falhas)

`ensureMusic()`: `music/*.mp3` locais (versionados, rotação diária por
dia-do-ano) → download `KIT_MUSIC_URL`/`MUSIC_URL` → **pad sintetico**
gerado pelo próprio ffmpeg. `reelHasAudio()` verifica o MP4 final e
remuxa se necessário — reel nunca sai mudo. Mix: faixa contínua única
(não fatias por clipe), `dynaudnorm` + `alimiter`, fade in/out nas
pontas apenas.

### Testes manuais

```bash
npm run kit:daily                    # gera e envia com o tema de hoje
KIT_THEME_DAY=1 npm run kit:daily    # força tema (0=dom ... 6=sáb)
```

---

## Funcionalidades

### Monetização / Afiliados

- Todo clique passa por `/ir/[id]` — registra `Click` e redireciona com tracking da fonte.
- **Disclosure de afiliado** no footer, página do produto, CTAs e seção "Por que confiar".
- Verificação do canal Lomadee via `<meta name="lomadee" content="2324685">` (Search Console-style).
- Verificação do domínio no **Google Search Console** via `verification.google` no metadata.

### UX / Conversão

- Duas abas no menu: **Produtos** (catálogo unificado de todas as fontes — busca cobre produtos, ofertas e cupons) e **Cupons** (itens de cupom/oferta: `couponCode` de qualquer fonte + campanhas Lomadee).
- Aba Produtos: ordenação intercalada por fonte via `ROW_NUMBER` por prefixo + merge por rodada (busca e filtros respeitados; fontes pequenas como Amazon aparecem em toda página). Aba Cupons: ordenada pelos que terminam primeiro.
- "Lojas em destaque" na aba Produtos — qualquer loja com itens ativos.
- Busca (`?q=`), filtro de loja (`?loja=`), categoria (`?categoria=`) e subtipo (`?tipo=`).
- Paginação `?pagina=` (24–48 itens/página conforme a visão).
- Cards com logo da loja, badge de fonte, desconto, cupom, urgência e prova social (cliques 30d ≥ 3).
- Página de produto: preço, economia, "por que aproveitar agora", cupom copiável, countdown, relacionados, share WhatsApp, imagens p/ Instagram (login) e JSON-LD.
- Tema claro/escuro, barra de categorias expansível, skeleton de loading.

### Estatísticas e privacidade do `/admin`

- `Click` guarda pageviews (sentinela `internal:pageview`) e cliques de afiliado.
- **Não conta**: admin logado (sessão Supabase validada via `getUser` em `/api/pv` e `/ir`), bots/crawlers (`isBot` em `src/lib/bots.ts` — headless, Googlebot, SEO bots, previews de WhatsApp/Telegram etc.).
- Comissões/receita vêm das **APIs das próprias redes** (`src/lib/reports.ts`) — não são dados locais.

### Imagens e qualidade do catálogo

- `imgSrc()` codifica URLs com espaços (feeds VTEX).
- Validador contínuo no sync testa **link + imagem**: 404/410/400 ou HTML no lugar de imagem = produto desativado; 403/429 (rate-limit) é ambíguo e **não** desativa.
- Admin reporta "produtos sem imagem" (excluindo o sentinela `internal:pageview`).

---

## SEO

- `sitemap.xml` = **índice** → `/sitemaps/pages` (home, cupons, ofertas, categorias) + `/sitemaps/produtos/[page]` (1.000 URLs/produto, ~23 páginas). Índice evita o erro "não foi possível buscar" do Search Console com sitemap único de ~4MB.
- `robots.txt`: `allow: /`, `disallow: /ir/`.
- Metadata global: template `%s | Ofertaço Radar`, keywords pt-BR, OG `pt_BR`, Twitter `summary_large_image`, `og:image` = `/api/og`.
- Home: JSON-LD `WebSite` + `Organization`.
- Produto: canonical, OG com imagem, JSON-LD `Product`/`Offer`/`BreadcrumbList`.
- `/?aba=cupons`: canonical + OG herdados da home.
- Performance da home: queries independentes em `Promise.all`, contagens por fonte numa `$queryRaw` com `FILTER`.

---

## Modelo de dados (`prisma/schema.prisma`)

- **Product** — `externalId` unique por fonte (`camp-lomadee:`/`prod-lomadee:`/`ml:`/`aw:`/`amz:`/`internal:pageview`), `title`, `description`, `imageUrl`, `price`/`oldPrice`/`discountPct`, `currency`, `category`, `subtype`, `merchant`, `organizationId`, `url`, `affiliateUrl`, `couponCode`, `endsAt`, `active`, timestamps.
- **Click** — `productId`, `referer`, `userAgent`, `createdAt` (pageviews + cliques de afiliado).
- **TrackedLink** — cache `sourceUrl → shortUrl` do shortener Lomadee.
- **AffiliatedOrg** / **Brand** — orgs e marcas Lomadee (logos das lojas).
- **SyncState** — estado dos syncs: `key`, `phase`, `page`, `lastCycleAt`, `busyAt`. Chaves: `main` (Lomadee), `ml` (ML), `ml-token` (OAuth), `amazon` (PA-API) + auxiliares `${key}:beat` e `${key}:err` (sinal de vida e último erro, sem migração de schema).
- **ScriptState** — KV genérico (`key`, `value` JSON) para scripts em ambiente efêmero. Hoje: `kit-sent` = histórico anti-repetição do kit diário (14 dias). Criada via `scripts/migration-scriptstate.sql` + `DISABLE ROW LEVEL SECURITY`.

---

## Variáveis de ambiente

| Var | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres (Supabase) — pooled (`pgbouncer`, `connection_limit=5`) |
| `LOMADEE_API_KEY` | uma das duas* | API affiliate Lomadee (`x-api-key`) — habilita sync incremental + shortener |
| `LOMADEE_API_URL` | não | default `https://api.lomadee.com.br` |
| `LOMADEE_PRODUCTS` | não | `=1` importa catálogo `/affiliate/products` no sync **manual** |
| `FEED_URL` | alternativa* | Feed XML/JSON genérico (somente sync manual) |
| `CRON_SECRET` | recomendado | protege `/api/cron/sync` (cron-job.org) |
| `ML_CLIENT_ID` / `ML_CLIENT_SECRET` | não | app Mercado Livre — habilita sync ML |
| `ML_AUTH_SECRET` | não | protege `/api/ml-auth/start` e o `state` do OAuth |
| `ML_AFFILIATE_TOOL` / `ML_AFFILIATE_WORD` | não | `matt_tool`/`matt_word` do afiliado ML — comissão em `ml:*` |
| `AMZ_TAG` | não | Partner Tag Amazon (default `synapsecodeon-20`) |
| `AMZ_API_KEY` / `AMZ_API_SECRET` | não | credenciais PA-API 5.0 — habilita sync automático Amazon |
| `AMZ_MARKETPLACE` / `AMZ_HOST` / `AMZ_REGION` | não | defaults `www.amazon.com.br` / `webservices.amazon.com.br` / `us-east-1` |
| `AMZ_KEYWORDS` | não | lista de termos de busca do sync Amazon (vírgula) |
| `SERPAPI_KEY` | não | lookup de produtos Amazon no cadastro manual (`/admin`) — 100 buscas/mês grátis |
| `AWIN_FEEDS` | não | feeds de produtos Awin — JSON array (`[{"url","advertiser","awinmid"}]`) ou URLs separadas por `;`. Habilita sync `aw:` |
| `AWIN_AFFID` | não | publisher ID da Awin — monta deep link `cread.php` quando o feed não traz link rastreado |
| `NEXT_PUBLIC_SITE_URL` | recomendado | URL canônica — sitemap/canonical/OG/JSON-LD |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | auth do `/admin` |
| `NEXT_PUBLIC_INSTAGRAM_URL` | não | link do Instagram |
| `RESEND_API_KEY` | kit | chave Resend — envio do kit diário por email |
| `KIT_EMAIL` | kit | destinatário(s) do kit (vírgula separa vários) |
| `RESEND_FROM` | não | remetente (default `onboarding@resend.dev`) |
| `KIT_MUSIC_URL` / `KIT_MUSIC_URLS` | não | faixa(s) remota(s) de música do reel (vírgula separa; `music/*.mp3` locais têm prioridade) |
| `KIT_THEME_DAY` | não | força tema do kit em testes (0=dom … 6=sáb) |
| `KIT_HEALTHCHECK_URL` | kit | ping healthchecks.io — alerta se o kit não rodar (Actions) |

\* O sync incremental de Lomadee exige `LOMADEE_API_KEY`; `FEED_URL` só no sync manual.

---

## Sync de dados

### Arquitetura

- **Gatilhos**: `after()` no cron (`/api/cron/sync`, a cada 1min via cron-job.org), home (`/`), `/produto/[id]` e botão do `/admin` (`/api/admin/sync` → `startAllSyncs`). **Retornar a promise é obrigatório** — sem isso o `after()` resolve na hora e a function congela, matando o sync.
- **Travas/heartbeat** (`src/lib/sync-lock.ts`, compartilhado): `busyAt` na `SyncState` + heartbeat a cada 30s + linhas `:beat`/`:err`. Lock expira em 3min se o worker morrer.
- **Budget** ~45s por invocação; ciclos completam em múltiplas invocações via `phase`/`page` persistidos.
- **Dois pools Prisma**: `prisma` (páginas, `connection_limit=5`) e `syncPrisma` (`src/lib/db.ts`, `connection_limit=2`) para o sync não competir com queries do site.

### Por fonte

- **Lomadee** (`maybeSyncLomadee`): fases `brands → campaigns → products → reconciliação → validação de links+imagens`.
- **Mercado Livre** (`maybeSyncML`): fases `q:{índice}` sobre `ML_QUERIES` (~54 termos).
- **Amazon** (`maybeSyncAmazon`, em `src/lib/amazon.ts`): `SearchItems` por keywords; reconcilia `amz:` ausentes só em ciclo completo.
- Validação contínua desativa produto com **link ou imagem** quebrados (ver "Imagens e qualidade").

### Manual (`scripts/sync.ts` → `npm run sync`)

- Lomadee API (campanhas sempre; catálogo só com `LOMADEE_PRODUCTS=1`) ou `FEED_URL` genérico; ML com credenciais.
- Upsert por `externalId`; desativação por prefixo de fonte.

### Scraper Amazon local (`scripts/amz-scrape.ts` → `npm run amz:scrape`)

A Amazon bloqueia IP de datacenter (Vercel retorna 503/captcha), então o catálogo `amz:` pode ser alimentado por **scraping rodado na sua máquina** (IP residencial):

```bash
npm run amz:scrape -- --dry        # testa: lista produtos sem gravar
npm run amz:scrape                 # raspa todas as fontes e grava
npm run amz:scrape -- --pages 2    # limita a N paginas
npm run amz:scrape -- --only deals # so URLs que contenham "deals"
npm run amz:scrape -- --delay 8000 # pausa maior entre requests
npm run amz:scrape -- --max-new 5  # no maximo 5 produtos NOVOS (resto so atualiza)
```

- **Fontes** (editáveis em `SOURCES` no script): `/deals` e best-sellers de nichos (bebê) primeiro na fila, depois buscas direcionadas (`mamadeira`, `toldos` — páginas 1-3/2), best-sellers geral + verticais (eletrônicos, cozinha, beleza). A ordem importa: com `--max-new` a cota enche antes das fontes genéricas.
- **Extração**: quebra o HTML por `data-asin`, extrai título, preço atual, preço antigo (só com marcador de "de/riscar") e imagem (ampliada para 640px). Só cadastra produto com título + imagem + preço.
- **Upsert** por `amz:{ASIN}` via `addAmazonProduct` → rodar de novo **atualiza**, nunca duplica. `affiliateUrl` sai com `?tag=$AMZ_TAG`. `oldPrice` gravado pelo verify é preservado quando a listagem não traz "De:" (senão o desconto sumiria a cada scrape).
- **Rate limit**: pausa de 5s entre páginas; se a Amazon devolver página de bloqueio (~4KB) ou HTTP 503, o script tenta **fallback via Chromium logado** (mesma sessão do verify — fingerprint de browser real) e aborta se ambos falharem. Não rode em loop.
- **Layout mudou?** Se uma página válida retornar "0 produtos extraídos", o parser (`extract()`) precisa de ajuste — os seletores atuais estão comentados no script.
- Requer `.env` com `DATABASE_URL` (e `AMZ_TAG`, com default `synapsecodeon-20`).
- **Agendamento local**: `scripts/amz-cron.sh` é o wrapper para cron (`0 7 * * *` → scrape com `--max-new 5` + verify). Por padrão roda **em Docker** (`deploy/amazon/docker-compose.yml`, profile `scrape`, imagem `mcr.microsoft.com/playwright` + repo/sessão montados) com fallback pra execução local se o Docker estiver desligado; loga em `logs/amz-scrape.log`. Exige a máquina ligada; se a Amazon bloquear, o script aborta e o log mostra.

### Verificação de elegibilidade de afiliado (`scripts/amz-verify.ts` → `npm run amz:verify`)

Nem todo produto da Amazon gera comissão (vendedores fora do programa). O verificador usa a **sessão logada de associado** e a própria SiteStripe:

```bash
npm run amz:login     # abre Chromium, você loga na conta de associado,
                      # sessão salva em ~/.config/ofertacoradar/amz-state.json
npm run amz:verify    # verifica só os ASINs ainda não verificados
npm run amz:verify -- --all   # re-verifica tudo
```

- Para cada ASIN abre `/dp/{ASIN}` e observa a chamada `data.amazon.com.br/api/.../associate` que a SiteStripe dispara: `shareEligibility.eligible` ou botão "Obter link" → elegível; API sem `eligible` e sem botão → **inelegível (produto desativado)**.
- Conservador: sem sinal (sessão expirada, captcha, página quebrada) → **pula sem desativar**. 3 "sem sinal" seguidos abortam pedindo novo login.
- Desconto é detectado na página do produto: `.a-text-price` riscado **maior** que o preço atual (fora de `.a-price-range`, que é faixa de variações e não desconto) ou % de economia ("Você economizou…"). Preço e `oldPrice` são atualizados no banco a cada verificação.
- Rejeições: **inelegível** → desativa + bloqueio **permanente**; **sem preço de tabela** (sem desconto) → desativa + bloqueio de **7 dias** (volta sozinho se entrar em oferta — o scrape reativa e o verify re-julga). Blocklist em `~/.config/ofertacoradar/amz-blocked.json` (`{asin: expiresAt}`, `0` = permanente); scrape pula ASINs bloqueados.
- Conjunto já verificado fica em `~/.config/ofertacoradar/amz-verified.json` — reruns só checam novidades. O cron diário roda scrape → verify em sequência.
- Sessão expira com o tempo: se o verify logar "sessão expirou", rode `npm run amz:login` de novo.
- Requer Chromium do Playwright + libs locais em `~/.local/share/ofertacoradar-chromelibs` (instaladas sem sudo via `apt-get download` + `dpkg -x`).

---

## Comandos

```bash
npm run dev        # dev server (Turbopack)
npm run build      # build de produção
npm run start      # serve o build
npm run lint       # ESLint
npm run sync       # sync manual (tsx --env-file=.env)
npm run amz:scrape # scrape local do catalogo Amazon (ver secao abaixo)
npm run kit:daily  # kit Instagram: reel + cards + email (ver secao acima)
npm run recategorize         # dry-run da reclassificacao de categorias
npm run recategorize -- --apply   # aplica (cuidado: reclassifica o banco)
npm run db:push    # prisma db push
npx tsc --noEmit   # typecheck
npx vercel --prod --yes   # deploy manual
```

> `npm run db:push` pode falhar no pooler do Supabase (role sem ownership); alternativa: `ALTER TABLE` via `$executeRawUnsafe` ou linhas auxiliares no `SyncState` (padrão `:beat`/`:err`).

---

## Estrutura

```
src/
  app/
    page.tsx                     # catálogo (HomeExperience)
    cupons/page.tsx              # cupons do dia (camp-lomadee:)
    produto/[id]/page.tsx        # detalhe + JSON-LD + after(sync)
    ir/[id]/route.ts             # redirect afiliado + click (after)
    admin/page.tsx               # painel: KPIs, sync, form Amazon, export
    admin/kit/                   # preview visual do kit Instagram (login)
    categoria/[slug]/           # paginas de categoria indexaveis
    ofertas/                    # link-in-bio estilo Linktree
    feed/google.xml/            # feed Google Shopping (RSS + g:)
    login/                       # login Supabase
    api/
      pv/route.ts                # pageviews (sentinela, ignora bot/admin)
      cron/sync/route.ts         # ping externo → maybeSync*
      admin/sync|amz|export/     # admin: sync forçado, cadastro Amazon, CSV
      card/[id]/route.tsx        # PNG social (login)
      og/route.ts                # OG image padrão
      ml-auth/start|callback/    # OAuth ML
      instagram/kit/             # kit Instagram (login)
      health/route.ts
    layout.tsx                   # nav, footer, metadata global, verifications
    sitemap.ts / robots.ts / loading.tsx / not-found.tsx
  components/                    # HomeExperience, ProductCard, AdminAmzForm,
                                 # AdminSyncButton, PageViewTracker, FeaturedCarousel,
                                 # SearchBar, CategoryNav, CountdownTimer, etc.
  lib/
    db.ts                        # syncPrisma (pool separado p/ sync)
    syncer.ts                    # sync Lomadee+ML (ciclos, reconciliação, validação)
    sync-lock.ts                 # trava + heartbeat + beat/err compartilhados
    mercadolivre.ts              # OAuth ML + catálogo
    amazon.ts                    # PA-API SigV4 + sync + lookup/cadastro manual
    feed.ts                      # Lomadee API + feed XML/JSON
    sources.ts                   # SourceKey, labels, badges, prefixos
    bots.ts                      # isBot() — filtro de crawlers p/ estatísticas
    adminSession.ts              # hasAdminSession() — atalho por cookie
    linkcheck.ts                 # validação link+imagem (prefixos checáveis)
    categories.ts / format.ts / urgency.ts / site.ts / shortener.ts
    instagram.ts / instagramKit.ts   # captions + pool do kit diario
    reports.ts                   # receita/comissão estimada via APIs das redes
scripts/
  sync.ts / checklinks.ts / recheck.ts / recategorize.ts / dedup.ts / ml-auth.ts
  daily-kit.ts                  # kit diario: reel ffmpeg + cards + email Resend
  kit-cron.sh / amz-cron.sh     # wrappers de cron local (so o amz usa hoje)
  migration-*.sql               # DDL manual p/ Supabase SQL Editor
.github/workflows/
  kit.yml                       # kit diario 8h BRT (Actions, gratis)
  recategorize.yml              # reclassificacao dom 6h BRT
music/                          # faixas do reel (rotacao diaria, versionadas)
assets/logo.jpeg                # marca usada no intro/outro do reel
kit-out/                        # saida local do kit (gitignored): reel, PNGs,
                                # audit-*.json; sent.json virou ScriptState no banco
prisma/schema.prisma
```

---

## Roadmap sugerido

- [x] Sincronizador Awin (`aw:`) — pronto; falta só configurar `AWIN_FEEDS`/`AWIN_AFFID` quando os anunciantes forem aprovados
- [x] Kit diário do Instagram — reel + cards + email automáticos (cron 8h)
- [x] Classificação de categorias robusta — descrição como fallback, decode de entidades, `npm run recategorize`
- [ ] Amazon PA-API quando a conta Creators atingir 10 vendas/30 dias (credenciais `AMZ_API_KEY`/`AMZ_API_SECRET`)
- [ ] Reconciliar conversões via API `/orders` Lomadee (cliques → vendas → receita real)
- [x] Páginas `/categoria/[slug]` indexáveis (SEO)
- [x] Google Shopping feed — `/feed/google.xml` no Merchant Center (~20k aprovados)
- [ ] Usar `/api/card/[id]` como `og:image` por produto
- [ ] Postagem automática no Instagram via API Meta (aguarda app review)
- [ ] Amazon: scrape local roda em cron da máquina; migrar para API (PA-API/SerpApi) ou cortar quando a conta estiver ociosa

> Pendências detalhadas e priorizadas em [`PENDENCIAS.md`](./PENDENCIAS.md).
