<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Comandos

- `npm run dev` — dev server
- `npm run build` / `npm run start` — build e produção
- `npm run sync` — importa ofertas para o Postgres via Prisma
- `npm run checklinks` — varredura única: remove (deleta) produtos cujo link do parceiro está morto (404/página "não encontrada"); `ml:` não é checado (anti-bot)
- `npm run db:push` — aplica mudanças do `prisma/schema.prisma` (pode travar no Supabase pooler; alternativa: `ALTER TABLE` via `$executeRawUnsafe`)
- Banco: PostgreSQL no Supabase (`DATABASE_URL`), Prisma 6 `prisma-client-js`
- `DATABASE_URL` usa `connection_limit=5` (pooler Supabase multiplexa; `=1` estrangulava a home em ~20s). O sync em background usa `syncPrisma` (`src/lib/db.ts`) com pool próprio `connection_limit=2` para não competir com as queries da página — `src/lib/syncer.ts` e `src/lib/mercadolivre.ts` importam `syncPrisma as prisma`.
- **Catalogo cheio (~22k+)**: `SYNC_QUOTA_*` no `.env` controla o teto por fonte no `scripts/sync.ts` (sync manual completo); o syncer continuo (`src/lib/syncer.ts`) nao tem cota — importa tudo das orgs afiliadas. `ML_MAX_OFFSET=1000` (busca ML ~33 pag/query × 47 queries). Upsert tem validacao dura: url http(s), price>0, imageUrl/affiliateUrl http(s) — invalido nem entra. `npm run retention` (semanal) agora tambem purga produtos com `endsAt` vencido. `npm run purge:inactive` remove inativos legados.
- **Egress Supabase**: o pooler (Supavisor) cobra por byte que SAI do banco — pageviews e feeds pesados estouraram 5GB/mes (63GB medido). Regras: listagens SEMPRE usam `CARD_SELECT` (`src/lib/card-select.ts`, so os campos do card — `description`/urls ficam de fora); feed/sitemap usam cache em memoria `memoTtl` (`src/lib/memo.ts`, container longevo); kit usa `KIT_SELECT`. Nao voltar a `findMany` sem select em rotas publicas.
- **Base so tem produtos ativos**: "desativar" = deletar a linha via `src/lib/product-purge.ts` (`purgeProducts`/`purgeProductsByIds` — apaga PriceHistory junto; Click sai em cascade). Link morto tambem grava tombstone em `ScriptState` key `dead-links` (cap 20k) para o feed nao recriar — `upsertByExternalId` barra externalId tombado. `scripts/purge-inactive.ts` limpa inativos legados.
- Syncs `maybeSync*` (Lomadee/ML/Awin/Amazon) têm **backoff de 10min após falha** (`errorBackoffActive` em `src/lib/sync-lock.ts`, chave `${key}:err`) — sem isso cada pageview/cron retentava na hora e a retry storm sufocava o pool, travando a home. `force=true` ignora o backoff.
- `NEXT_PUBLIC_SITE_URL` — domínio canônico usado em sitemap/metadata/JSON-LD (fallback: `VERCEL_URL` ou localhost)
- `.env.example` documenta todas as env vars (sem valores). Ao adicionar var nova, registrar lá.
- **Admin = allowlist de email** (`ADMIN_EMAILS` csv; fallback `KIT_EMAIL`; fail-closed sem as duas). Toda rota `/api/admin/*`, `/api/card`, `/api/instagram/kit` e as paginas `/admin/*` usam `isAdmin()`/`isAdminEmail()` de `src/lib/admin.ts` — nunca reintroduzir check so de `getUser()`. Endpoints publicos (`/api/pv`, `/api/notify`, `/api/search`) tem rate limit in-memory em `src/lib/ratelimit.ts`.
- Testes: `npm test` (vitest, `src/**/*.test.ts`).
- Loading: navegação interna usa `NavProgress` no nível do `<body>`
  (overlay full-screen: fundo esmaecido + spinner) — NÃO dentro do
  header porque o `backdrop-blur` dele quebra `position:fixed`.
  Cobre cliques, forms GET, `popstate` e `pushState/replaceState`;
  o início é amarrado à URL de destino (`navTarget`) para não ser
  consumido por renders intermediárias. O router do Next NÃO passa
  por `window.fetch` de forma observável — então a prova de "carregou"
  é o DOM: MutationObserver em `document.documentElement` (NÃO
  `document.body` — pode ser null durante a troca) deve ficar quieto
  ~1s + todas as imagens/fontes do conteúdo prontas, sustentado por
  ~1.5s; failsafe 20s + watchdog 25s. O boot (F5) usa script inline
  no `layout.tsx` (`data-boot-progress`, barra fina no header) até
  `window.load`.
- Widget Chatwoot: `src/components/ChatwootWidget.tsx` (`next/script` afterInteractive, montado no root layout). URL/token via `NEXT_PUBLIC_CHATWOOT_BASE_URL`/`NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN` (default `chat.ofertacoradar.com.br`).
- **`NEXT_PUBLIC_*` é inlinada no bundle em build-time**: no Docker (`deploy/site/`), rebuild exige `docker compose --env-file .env -f deploy/site/docker-compose.yml up -d --build` — sem isso o bundle sai com Supabase URL vazia e a home quebra no client ("This page couldn't load" com HTTP 200).

## Notas

- Next.js 16 com `cacheComponents` desligado (renderização dinâmica simples).
- Fontes de afiliado (prefixo em `Product.externalId`): `camp-lomadee:` = oferta/cupom **Lomadee**, `prod-lomadee:` = produto **Lomadee**, `ml:` = produto **Mercado Livre**, `aw:` = produto **Awin**. `LOMADEE_API_KEY` (API Lomadee) ou `FEED_URL` (XML/JSON genérico → `fetchFeed`, também Lomadee). API tem precedência.
- Com `LOMADEE_API_KEY`, o sync importa **campanhas** (`/affiliate/campaigns`, status `onTime`) — são ofertas/cupons com `lmdee.link` já rastreado por canal = comissão. Catalogo de produtos (`/affiliate/products`) só entra com `LOMADEE_PRODUCTS=1` e usa link direto da loja (SEM comissão).
- API Lomadee: limite de 20 itens/página em brands/campaigns, rate limit 60 req/min, 500 intermitente em algumas páginas (sync pula e segue). Paginação: campaigns/orders usam `meta`, brands usa `pagination`, products usa `count`.
- Feed XML: campos mapeados de forma tolerante (title/name, price/preco, link/url, image/imagem etc.).
- Atenção: API de produtos retorna URL direta da loja; link comissionado pode exigir feed XML lomadeezado ou shortener (`POST /affiliate/shortener/url`).
- Redirect de afiliado: `/ir/[id]` registra clique e redireciona para `affiliateUrl` (ou `url`; produtos `prod-lomadee:` sem affiliateUrl geram `lmdee.link` via shortener, cacheado em `TrackedLink`).
- **Sem duplicatas, nunca** — `upsertByExternalId` bloqueia criar produto
  com título idêntico (case-insensitive) já ativo de OUTRA fonte
  (camp- isento: cupons de lojas diferentes não são o mesmo produto);
  `npm run dedup` (semanal no recategorize.yml) consolida duplicatas
  cross-source por título normalizado + cluster de preço ±20%,
  mantendo a fonte com comissão própria (ml:/amz: > aw:/camp- > prod-).
- `Product.discountPct` — % de desconto calculado no sync (alimenta ordenação "Maior desconto" e relacionadas). Manter atualizado em `scripts/sync.ts` e `src/lib/syncer.ts`.
- **Disco Supabase free = 500MB** — estourou uma vez (nov/2026): PriceHistory gravava 1 linha/produto/sync (~20k/dia). Agora `upsert.ts` só insere quando o preço MUDA, e `npm run retention` (semana, no workflow recategorize) apaga PriceHistory>180d (exceto o menor preço — página usa só `_min`), Event>90d, Click>180d. Emergência manual: `scripts/cleanup-disk.sql` no SQL Editor. Se voltar a encher, considerar Pro (~$25/mês, disco expande) ou reduzir retenção.
- Home tem abas/ordenação/filtros via query params: `aba` (ofertas|lojas|ml|awin — cada aba e uma fonte, sem misturar), `q`, `categoria`, `loja`, `ordem` (desconto|recentes|terminando|populares), `pagina`. URLs `/ir/` ficam fora do sitemap e são `Disallow` no robots.
- Rotinas agendadas: **cron-job.org → GitHub Actions** (grátis), não cron local. O gatilho oficial é `workflow_dispatch` via API do GitHub (cron-job.org é pontual); o `schedule:` do workflow é só backup — free tier do GH pula/atrasa execuções. `/admin/servicos` monitora servicos internos/externos (site, chat, Supabase, GH Actions, syncs, disco). `.github/workflows/kit.yml` (kit diário 8h BRT), `recategorize.yml` (dom 6h BRT) e `db-disk.yml` (seg 9h BRT — relatório semanal de % de disco Supabase por email, `npm run db:disk`, limite via `DB_DISK_LIMIT_MB` default 500). Secrets no repo: DATABASE_URL, RESEND_*, KIT_*, CRON_SECRET, NEXT_PUBLIC_SITE_URL. O histórico anti-repetição do kit fica em `ScriptState` (key `kit-sent`) — `sent.json` local é só fallback. Healthcheck: `KIT_HEALTHCHECK_URL` (healthchecks.io).
- Queries pesadas do kit (`ORDER BY discountPct` em ~20k produtos) cobertas por `Product_kit_discount_idx` (ver `scripts/migration-product-discount-idx.sql`) + `withRetry` no `daily-kit.ts` — statement_timeout do pooler é transitório quando o sync compete.
- Cards do kit (`/api/card/[id]`, anexos do email): o `next/og` **não embute webp** (imagens `ml:` são .webp — saíam sem foto). A rota baixa a imagem com UA de browser + retry, converte webp/avif/svg p/ PNG via `sharp` (dependência explícita) e passa **data URI** pro renderer — nunca depender de `<img src>` remoto no satori. Logo da loja idem. Cache em memória 6h/400 urls (`imgCache` na rota). `?requireImage=1` → 404 se não houver foto utilizável; o `daily-kit.ts` valida cada item com esse param, substitui falhas por candidatos do pool e **só envia o email com exatamente 4 produtos com foto** (senão aborta + healthcheck /fail).
- Tabelas novas no Supabase: `db push` falha no pooler e o usuário `ofertacoradar_app` não tem DDL — criar via SQL Editor (ver `scripts/migration-*.sql`) e `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` (RLS vem ativo e bloqueia o app). Conexão direta `db.<ref>.supabase.co` é IPv6-only — usar session pooler `aws-1-us-east-1.pooler.supabase.com:5432` com user `postgres.<ref>` quando precisar de DDL/master.
- Scrape **Mercado Livre** (`ml:`) é via **sessão logada + Playwright**
  (`scripts/ml-scrape.ts`), NÃO pela API — o ML bloqueia preços de
  terceiros (403 PolicyAgent) e busca anônima (account-verification).
  Sessão: `scripts/ml-login.ts` salva o perfil persistente
  `~/.config/ofertacoradar/ml-profile2` (expira — refazer login quando
  o scrape logar "sessao provavelmente expirou"). Cron local
  `scripts/ml-cron.sh` (crontab 9h/21h) → `deploy/ml/` (mesma imagem
  Playwright do `deploy/amazon/`). URLs: `lista.mercadolivre.com.br/{slug}`
  (slug com hífens, offset `_Desde_N` de 48), queries em `QUERIES`.
  `ML_SYNC=0` desliga o loop de API (queima rate limit à toa — sem uso).
  Comissão ML: `/ir/` monta `/p/{catalogId}?matt_tool&matt_word`.
  Scrapers registram resultado em `ScriptState` `scrape:{ml|amz}`
  (`reportScrape` em `src/lib/scrape-state.ts`) e o botão no
  `/admin/servicos` grava `scrape-request:{src}` — o dispatcher
  local `scripts/scrape-dispatch.sh` (cron 1min, flock) executa no
  host (Docker ou fallback local) e limpa o pedido. Mesmo esquema
  pro Amazon (`deploy/amazon/`).
- Scrape Amazon roda em **Docker** (`deploy/amazon/`, imagem `mcr.microsoft.com/playwright` + repo montado): cron `amz-cron.sh` chama `docker compose run --rm scrape` com fallback local se Docker estiver off. Precisa de IP residencial (Amazon bloqueia datacenter) e sessão em `~/.config/ofertacoradar/amz-state.json` (montada no container). Profile `scrape` — não sobe com `up -d`.
- **Site self-hosted local** (`deploy/site/`): Next.js `output: standalone` em Docker (`ofertacoradar-site`), container `site-web` na rede `chatwoot_default`, sem porta publicada — acesso só via tunnel. Subir/rebuild: `docker compose --env-file .env -f deploy/site/docker-compose.yml up -d --build` (o `--env-file` alimenta os build args `NEXT_PUBLIC_*`). Vercel pausou a conta free (Fluid CPU 192%) — se voltar pro Pro, é só apontar o DNS de volta (registros A/CNAME na Cloudflare) e remover as rotas do tunnel.
- **Chatwoot self-hosted local** (`deploy/chatwoot/`, WSL2 + Docker Desktop): compose com `chatwoot/chatwoot:v4.17.1-ce`, **`pgvector/pgvector:pg16`** (obrigatório — schema usa extensão `vector`), redis:7-alpine, caddy. `.env` local (não commitar — tem segredos). Subir: `docker compose up -d`; migrations: `docker compose exec rails bundle exec rails db:chatwoot_prepare`. Exposição pública via container `chatwoot-tunnel` (cloudflared) com **túnel nomeado** `chat.ofertacoradar.com.br` → `rails:3000` **e `ofertacoradar.com.br`/`www` → `site-web:3000`** (o site Next.js também sai por esse túnel — container `site-web` na rede `chatwoot_default`, sem porta publicada); credenciais em `deploy/chatwoot/cloudflared/` (gitignored). DNS na Cloudflare — registros do site "DNS only" (proxy OFF). O túnel serve `chat.` → rails e `ofertacoradar.com.br`/`www` → site-web (ver `cloudflared/config.yml`).
- **Auto-atendente 24/7** (`deploy/chatwoot/bot/`): container Node sem deps que recebe webhooks do Agent Bot "Site Ofertaço" (`outgoing_url` → `https://chat.ofertacoradar.com.br/bot-hook/hook`, path roteado no `cloudflared/config.yml` → `bot:3000`), chama OpenRouter (`OPENROUTER_*` no `.env`) e responde como AgentBot. **Auto-conecta o bot a TODAS as inboxes** a cada 10min via `set_agent_bot` — inbox nova (WhatsApp/Telegram/Instagram) passa a ser atendida sozinha. Tokens no `.env`: `CHATWOOT_API_TOKEN` (user, leitura) e `CHATWOOT_BOT_TOKEN` (agent bot, responder — bots CE só acessam `messages#create`). Captain Tasks (Copilot) usa OpenRouter via `llm.yml`/`llm_models.json` montados no compose; "Ask Copilot" livre é Enterprise-only (não existe no CE).
- **Estado do Chatwoot** (configurado via `rails runner`, não pela UI): inbox WebWidget "Ofertaço Radar" (website_token `MXgaVtRYrRwZkG5BZQftAYhK`, `allowed_domains` restrito ao domínio, greeting pt-BR, CSAT, email collect, sender professional); **Help Center** portal `central-de-ajuda` (pt_BR, 9 artigos, URL `/hc/central-de-ajuda`) ligado ao inbox — o widget mostra o link sozinho; inbox **"API / Integrações"** (Channel::Api + AgentBot "Site Ofertaço", token em `CHATWOOT_API_TOKEN` no `.env` do chatwoot — usar `api_access_token` header nas chamadas `/api/v1/accounts/1/...`); labels Site/Cupom/Frete/Pedido/Reclamacao/Duvida; canned responses `oi cupom frete prazo humano`; automation rule "Conversas do site" (conversation_created no inbox 1 → label Site). `ENABLE_ACCOUNT_SIGNUP=false` (só admin entra). **SMTP**: Resend via `smtp.resend.com:587` + `SMTP_ENABLE_STARTTLS_AUTO=true` — porta 465 sem `SMTP_SSL=true` dá timeout (bug corrigido). Canais Meta (WhatsApp/FB/IG) pendentes de credenciais; Telegram precisa de bot token; Captain (IA) precisa de chave LLM.
