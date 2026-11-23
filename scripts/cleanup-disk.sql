-- EMERGENCIA: disco do Supabase free tier (500MB) esgotado.
-- Rodar no SQL Editor do Supabase (Dashboard → SQL Editor) quando o
-- banco voltar a responder. Depois rodar "VACUUM" na mesma sessão.
--
-- IMPORTANTE: estes DELETEs sao agressivos — a retencao normal
-- (scripts/retention.ts, semanal) ja cuida disso depois.

-- 1) PriceHistory: mantem só o MENOR preço de cada produto
--    (a página usa apenas _min — histórico intermediário é prescindível)
DELETE FROM "ofertacoradar"."PriceHistory" h
USING (
  SELECT "productId", min(price) AS minprice
  FROM "ofertacoradar"."PriceHistory"
  GROUP BY "productId"
) m
WHERE h."productId" = m."productId"
  AND h.price > m.minprice;

-- 2) Event (analytics): últimos 30 dias bastam
DELETE FROM "ofertacoradar"."Event"
WHERE "createdAt" < now() - interval '30 days';

-- 3) Click (afiliado): últimos 90 dias
DELETE FROM "ofertacoradar"."Click"
WHERE "createdAt" < now() - interval '90 days';

-- 4) SyncState órfãos (chaves lp:* de produtos removidos) — opcional,
--    a tabela é pequena; descomente se quiser:
-- DELETE FROM "ofertacoradar"."SyncState" s
-- WHERE s.key LIKE 'lp:%'
--   AND NOT EXISTS (
--     SELECT 1 FROM "ofertacoradar"."Product" p
--     WHERE 'lp:' || p."externalId" = s.key
--   );

-- 5) Reincorpora espaço apagado (sem FULL — não precisa de disco livre
--    extra como o VACUUM FULL precisaria):
VACUUM (VERBOSE) "ofertacoradar"."PriceHistory";
VACUUM (VERBOSE) "ofertacoradar"."Event";
VACUUM (VERBOSE) "ofertacoradar"."Click";
VACUUM (VERBOSE) "ofertacoradar"."Product";
