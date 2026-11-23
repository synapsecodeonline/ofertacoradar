-- ============================================================
-- LIMPEZA DE EMERGENCIA — disco Supabase free (500MB) cheio
-- Rodar no SQL Editor do Supabase: Dashboard → SQL Editor
-- Cola TUDO de uma vez e executa. Os SELECTs no início mostram
-- o tamanho de cada tabela ANTES de apagar.
-- ============================================================

-- ── 0) DIAGNÓSTICO: quanto cada tabela ocupa ─────────────────
SELECT relname AS tabela,
       pg_size_pretty(pg_total_relation_size(relid)) AS tamanho
FROM pg_catalog.pg_statio_user_tables
WHERE schemaname = 'ofertacoradar'
ORDER BY pg_total_relation_size(relid) DESC;

SELECT 'PriceHistory' AS tabela, count(*) FROM "ofertacoradar"."PriceHistory"
UNION ALL SELECT 'Event', count(*) FROM "ofertacoradar"."Event"
UNION ALL SELECT 'Click', count(*) FROM "ofertacoradar"."Click"
UNION ALL SELECT 'Product ativos', count(*) FROM "ofertacoradar"."Product" WHERE active
UNION ALL SELECT 'Product inativos', count(*) FROM "ofertacoradar"."Product" WHERE NOT active;

-- ── 1) PriceHistory → só o MENOR preço de cada produto ────────
-- A página de produto usa apenas _min (menor preço histórico).
-- Apaga todo o resto — é de longe a tabela que mais cresce.
DELETE FROM "ofertacoradar"."PriceHistory" h
USING (
  SELECT "productId", min(price) AS minprice
  FROM "ofertacoradar"."PriceHistory"
  GROUP BY "productId"
) m
WHERE h."productId" = m."productId"
  AND h.price > m.minprice;

-- ── 2) Event (analytics de pageview/click) → últimos 30 dias ─
DELETE FROM "ofertacoradar"."Event"
WHERE "createdAt" < now() - interval '30 days';

-- ── 3) Click (cliques de afiliado) → últimos 90 dias ─────────
DELETE FROM "ofertacoradar"."Click"
WHERE "createdAt" < now() - interval '90 days';

-- ── 4) Produtos INATIVOS → apagar de vez ─────────────────────
-- Inativos já não aparecem no site (links mortos/removidos).
-- O sync pode recriar se a fonte listar de novo — aí vem com
-- dados frescos, o que é bom.
DELETE FROM "ofertacoradar"."Product" WHERE active = false;

-- ── 5) Reduzir catálogo ativo (OPCIONAL — descomente se quiser
--    menos de ~20k produtos). Mantém só os atualizados nos
--    últimos 7 dias — o sync diário renova os que importam.
--    Cuidado: esvazia abas de categorias frias.
-- DELETE FROM "ofertacoradar"."Product"
-- WHERE "updatedAt" < now() - interval '7 days';

-- ── 6) SyncState órfãos (chaves lp:* sem produto) ────────────
DELETE FROM "ofertacoradar"."SyncState" s
WHERE s.key LIKE 'lp:%'
  AND NOT EXISTS (
    SELECT 1 FROM "ofertacoradar"."Product" p
    WHERE 'lp:' || p."externalId" = s.key
  );

-- ── 7) RECUPERAR O ESPAÇO — VACUUM simples ───────────────────
-- (NÃO use VACUUM FULL: ele precisa de espaço livre extra igual
-- ao tamanho da tabela — com disco cheio ele falha.)
VACUUM (VERBOSE) "ofertacoradar"."PriceHistory";
VACUUM (VERBOSE) "ofertacoradar"."Event";
VACUUM (VERBOSE) "ofertacoradar"."Click";
VACUUM (VERBOSE) "ofertacoradar"."Product";

-- ── 8) CONFERIR RESULTADO ────────────────────────────────────
SELECT relname AS tabela,
       pg_size_pretty(pg_total_relation_size(relid)) AS tamanho
FROM pg_catalog.pg_statio_user_tables
WHERE schemaname = 'ofertacoradar'
ORDER BY pg_total_relation_size(relid) DESC;
