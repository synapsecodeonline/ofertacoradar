# Pendências — Ofertaço Radar

> Atualizado em 22/11/2026. Itens agrupados por o que depende de você,
> de terceiros, ou de código.

## ⏳ Dependem de ação sua / terceiros

- [x] ~~Conta Resend~~ — domínio `ofertacoradar.com.br` verificado;
      envio liberado para qualquer destinatário com
      `RESEND_FROM=kit@ofertacoradar.com.br`.
- [x] ~~Domínio próprio~~ — `ofertacoradar.com.br` + `www` na Vercel
      com SSL ativo; `NEXT_PUBLIC_SITE_URL` atualizado; Search Console
      verificado e sitemap processado (dividido em índice + 23
      sub-sitemaps de 1000 URLs).
- [ ] **Awin** — código pronto (`aw:`), mas oculto até aprovação dos
      anunciantes. Depois: configurar `AWIN_FEEDS` + `AWIN_AFFID` no
      `.env` e remover qualquer ocultação pública se houver.
- [ ] **Conta Meta/Instagram API** — app review para
      `instagram_content_publish` permitiria postar o kit sozinho
      (hoje o fluxo é email → postar manual, ~10 min/dia).
- [ ] **Amazon PA-API** — aguarda conta de associado atingir 10
      vendas/30 dias para liberar credenciais `AMZ_API_KEY`/`AMZ_API_SECRET`.
      Até lá o catálogo `amz:` é alimentado por scrape **em Docker**
      (`deploy/amazon/`, cron 7h via `amz-cron.sh` — precisa PC ligado
      e IP residencial; Amazon bloqueia IP de datacenter).
- [ ] **Chatwoot no ar** — stack self-hosted rodando **local** no WSL2
      (`deploy/chatwoot/`: rails+sidekiq+postgres pgvector+redis+caddy).
      Acesso público via **cloudflared tunnel nomeado** (container
      `chatwoot-tunnel`): `https://chat.ofertacoradar.com.br` fixo,
      credenciais em `deploy/chatwoot/cloudflared/` (gitignored).
      DNS já migrado p/ Cloudflare (nameservers `lilith`/`melnicoff`);
      registros do site em **DNS only** (proxy OFF — proxy lento c/
      streaming do Next.js). Widget do site no ar via
      `ChatwootWidget.tsx`. Pendente: terminar inbox WhatsApp
      Cloud API + webhook Meta.

## 🔧 Melhorias técnicas pendentes

- [ ] **Disco Supabase (500MB free) estourou** — banco caiu por disco
      cheio. Causa: PriceHistory inseria ~20k linhas/dia. Corrigido no
      código (só grava em mudança de preço + `npm run retention`
      semanal). Pendente: rodar `scripts/cleanup-disk.sql` no SQL
      Editor quando o banco voltar + observar se disco estabiliza.
      Se crescer de novo → Pro plan ou reter menos.

- [ ] **~600 produtos em "outros"** — maioria banners de campanha sem
      sinal textual. Retorno decrescente; reavaliar só se incomodar.
- [x] ~~**Recategorizar periodicamente**~~ — weekly no GitHub Actions
      (`.github/workflows/recategorize.yml`, dom 6h BRT via cron-job.org).
- [x] ~~**Auditoria do kit**~~ — `kit-out/audit-AAAA-MM-DD.json` grava
      score, cliques, boosts, família, fonte e janela de exclusão.
- [ ] **Rodízio de música** — já existe via `music/*.mp3`; adicionar
      mais faixas conforme o gosto (todas as do kit usam a mesma
      rotação diária).

## 📈 SEO / crescimento (backlog original)

- [x] **Google Shopping feed** — `/feed/google.xml` configurado no
      Merchant Center (busca programada diária); ~20k produtos
      aprovados. Acompanhar desaprovações por item e limpar feed
      conforme o Google reportar.
- [ ] **Search Console** — sitemap já existe; acompanhar indexação e
      corrigir páginas com erro.
- [ ] **Páginas de categoria** — `/categoria/[slug]` já existe;
      avaliar quais categorias têm volume para páginas de apoio.
- [ ] **`/api/card/[id]` como og:image por produto** — cards bonitos
      já são gerados; usar como imagem de prévia nos compartilhamentos.
- [ ] **Reconciliar conversões** — cliques estão no banco; receita real
      vem das APIs das redes (`src/lib/reports.ts`). Cruzar clique →
      venda exigiria relatórios das plataformas.

## ✅ Recentemente concluído (referência)

- **Infra 100% nuvem** — kit diário e recategorização migraram do
  cron local para GitHub Actions (grátis); gatilho oficial é
  cron-job.org → `workflow_dispatch` (schedule do GH é só backup —
  free tier pula execuções). Healthcheck healthchecks.io ativo.
- Histórico anti-repetição do kit migrado de `sent.json` para
  `ScriptState`/`kit-sent` (banco) + retry em timeout de statement
  do pooler + índice `Product_kit_discount_idx`.
- Kit com **diversidade de fonte** (máx. 2 itens por loja nos 4).
- `/ofertas` reformulada (link-in-bio com provas sociais ao vivo e
  seção "terminando em 24h"). GA4 (`G-3MCVT83YZN`) coletando.
- **Chatwoot self-hosted** — `deploy/chatwoot/docker-compose.yml`
  (imagem `chatwoot/chatwoot:v4.17.1-ce` + `pgvector/pgvector:pg16` +
  redis + caddy). Postgres precisa de pgvector (Chatwoot usa extensão
  `vector` — `postgres:16-alpine` puro falha). Migrations manuais:
  `docker compose exec rails bundle exec rails db:chatwoot_prepare`.
  Cloudflare Tunnel nomeado (`chatwoot-tunnel` no compose; credenciais
  em `deploy/chatwoot/cloudflared/`, gitignored — `cloudflared tunnel
  login` no host gera `~/.cloudflared/`).
- Kit diário automático 8h → email com reel + cards + legenda combinada
- Classificação: descrição como fallback, decode de entidades HTML,
  ~900 produtos reclassificados, "outros" 1005 → 602
- Reel: logo, degradê animado, fonte Ubuntu Sans, áudio contínuo,
  rotação de músicas locais, piso de desconto 10%, rotação de produtos
  (14 dias sem repetir)
- Story não tem legenda — instruções do email corrigidas
