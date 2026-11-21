# Pendências — Ofertaço Radar

> Atualizado em 21/11/2026. Itens agrupados por o que depende de você,
> de terceiros, ou de código.

## ⏳ Dependem de ação sua / terceiros

- [x] ~~Conta Resend~~ — conta `noletodasilvaa@gmail.com` criada e
      testada (envia só para si mesma no plano free). Conta ativa
      atual: `synapsecode.online@gmail.com`. Envio para múltiplos
      destinatários depende do item "Domínio no Resend" abaixo.
- [ ] **Domínio no Resend** — `ofertacoradar.com.br` já está na Vercel e
      como `NEXT_PUBLIC_SITE_URL`. Falta: (a) DNS no registro.br
      (A @ → 216.198.79.1 e 64.29.17.1; CNAME www → cname.vercel-dns.com);
      (b) adicionar o domínio em resend.com/domains e copiar os
      registros DKIM/SPF pro DNS. Depois disso o envio libera para
      qualquer destinatário e o remetente vira `kit@ofertacoradar.com.br`.
- [ ] **Awin** — código pronto (`aw:`), mas oculto até aprovação dos
      anunciantes. Depois: configurar `AWIN_FEEDS` + `AWIN_AFFID` no
      `.env` e remover qualquer ocultação pública se houver.
- [ ] **Conta Meta/Instagram API** — app review para
      `instagram_content_publish` permitiria postar o kit sozinho
      (hoje o fluxo é email → postar manual, ~10 min/dia).
- [ ] **Amazon PA-API** — aguarda conta de associado atingir 10
      vendas/30 dias para liberar credenciais `AMZ_API_KEY`/`AMZ_API_SECRET`.
      Até lá o catálogo `amz:` é alimentado por scrape local
      (`npm run amz:scrape` + verify, cron 7h).

## 🔧 Melhorias técnicas pendentes

- [ ] **~600 produtos em "outros"** — maioria banners de campanha sem
      sinal textual. Retorno decrescente; reavaliar só se incomodar.
- [ ] **Recategorizar periodicamente** — rodar
      `npm run recategorize` (dry-run) e `--apply` após grandes syncs,
      pois produtos novos entram com a classificação do momento.
- [ ] **Auditoria do kit** — log de por que cada produto entrou
      (categoria, regex do tema, veto, desconto) ajudaria a depurar
      casos de tema errado sem consultar o banco.
- [ ] **Rodízio de música** — já existe via `music/*.mp3`; adicionar
      mais faixas conforme o gosto (todas as do kit usam a mesma
      rotação diária).

## 📈 SEO / crescimento (backlog original)

- [ ] **Google Shopping feed** — gerar XML/CSV de produtos para o
      Merchant Center (comissão via links `/ir/` ou direto).
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

- Kit diário automático 8h → email com reel + cards + legenda combinada
- Classificação: descrição como fallback, decode de entidades HTML,
  ~900 produtos reclassificados, "outros" 1005 → 602
- Reel: logo, degradê animado, fonte Ubuntu Sans, áudio contínuo,
  rotação de músicas locais, piso de desconto 10%, rotação de produtos
  (14 dias sem repetir)
- Story não tem legenda — instruções do email corrigidas
