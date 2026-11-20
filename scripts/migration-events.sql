-- Migracao manual: rodar no SQL Editor do Supabase (o pooler nao aceita
-- db push do Prisma). Owner = postgres. Idempotente (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS "ofertacoradar"."Event" (
  "id"          SERIAL PRIMARY KEY,
  "type"        TEXT NOT NULL,
  "productId"   INTEGER,
  "sessionId"   TEXT,
  "path"        TEXT,
  "referer"     TEXT,
  "userAgent"   TEXT,
  "utmSource"   TEXT,
  "utmMedium"   TEXT,
  "utmCampaign" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Event_type_createdAt_idx" ON "ofertacoradar"."Event" ("type", "createdAt");
CREATE INDEX IF NOT EXISTS "Event_sessionId_idx" ON "ofertacoradar"."Event" ("sessionId");
CREATE INDEX IF NOT EXISTS "Event_productId_idx" ON "ofertacoradar"."Event" ("productId");

CREATE TABLE IF NOT EXISTS "ofertacoradar"."Subscriber" (
  "id"        SERIAL PRIMARY KEY,
  "email"     TEXT NOT NULL UNIQUE,
  "productId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Subscriber_productId_idx" ON "ofertacoradar"."Subscriber" ("productId");

CREATE TABLE IF NOT EXISTS "ofertacoradar"."PriceHistory" (
  "id"         SERIAL PRIMARY KEY,
  "productId"  INTEGER NOT NULL,
  "price"      DOUBLE PRECISION NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PriceHistory_productId_recordedAt_idx" ON "ofertacoradar"."PriceHistory" ("productId", "recordedAt");

-- Backfill: menor preco historico que ja estava em SyncState (chave lp:*)
INSERT INTO "ofertacoradar"."PriceHistory" ("productId", "price", "recordedAt")
SELECT p."id", ss."phase"::numeric, ss."lastCycleAt"
FROM "ofertacoradar"."SyncState" ss
JOIN "ofertacoradar"."Product" p ON p."externalId" = substring(ss."key" from 4)
WHERE ss."key" LIKE 'lp:%' AND ss."phase" ~ '^[0-9]+(\.[0-9]+)?$'
ON CONFLICT DO NOTHING;
