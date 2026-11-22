-- Migracao manual: rodar no SQL Editor do Supabase (app user nao tem
-- DDL). Indice parcial para as queries do kit/admin que ordenam
-- produtos ativos por maior desconto — sem ele, o ORDER BY varre e
-- ordena ~20k linhas e estoura o statement_timeout do pooler quando
-- o sync esta pesado (kit das 8h morreu com erro 57014).

CREATE INDEX IF NOT EXISTS "Product_kit_discount_idx"
  ON "ofertacoradar"."Product" ("discountPct" DESC NULLS LAST)
  WHERE "active" = true;
