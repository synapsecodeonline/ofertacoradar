-- ============================================================
-- SETUP COMPLETO — projeto Supabase novo (recriação)
-- Rodar no SQL Editor do projeto NOVO, nesta ordem, tudo junto.
-- Gerado de prisma/schema.prisma + migrations manuais.
-- ============================================================

-- 1) Role da aplicação (usuario do DATABASE_URL)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ofertacoradar_app') THEN
    CREATE ROLE ofertacoradar_app LOGIN PASSWORD '7e7164dcda0ec521de01b81e28cc55adc1a2bc2c1e9fbc28';
  ELSE
    ALTER ROLE ofertacoradar_app LOGIN PASSWORD '7e7164dcda0ec521de01b81e28cc55adc1a2bc2c1e9fbc28';
  END IF;
END $$;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ofertacoradar";

-- CreateTable
CREATE TABLE "ofertacoradar"."Product" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" DOUBLE PRECISION,
    "oldPrice" DOUBLE PRECISION,
    "discountPct" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "category" TEXT,
    "subtype" TEXT,
    "merchant" TEXT,
    "organizationId" TEXT,
    "url" TEXT NOT NULL,
    "affiliateUrl" TEXT,
    "couponCode" TEXT,
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertacoradar"."Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "site" TEXT,
    "segment" TEXT,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertacoradar"."SyncState" (
    "key" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'brands',
    "page" INTEGER NOT NULL DEFAULT 1,
    "lastCycleAt" TIMESTAMP(3),
    "busyAt" TIMESTAMP(3),
    "orgsCleared" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ofertacoradar"."AffiliatedOrg" (
    "organizationId" TEXT NOT NULL,
    "name" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliatedOrg_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "ofertacoradar"."TrackedLink" (
    "id" SERIAL NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shortUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertacoradar"."Click" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "referer" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Click_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertacoradar"."Event" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "productId" INTEGER,
    "sessionId" TEXT,
    "path" TEXT,
    "referer" TEXT,
    "userAgent" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertacoradar"."Subscriber" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "productId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertacoradar"."PriceHistory" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ofertacoradar"."ScriptState" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "ScriptState_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_externalId_key" ON "ofertacoradar"."Product"("externalId");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "ofertacoradar"."Product"("category");

-- CreateIndex
CREATE INDEX "Product_category_subtype_idx" ON "ofertacoradar"."Product"("category", "subtype");

-- CreateIndex
CREATE INDEX "Product_active_idx" ON "ofertacoradar"."Product"("active");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedLink_sourceUrl_key" ON "ofertacoradar"."TrackedLink"("sourceUrl");

-- CreateIndex
CREATE INDEX "Click_productId_idx" ON "ofertacoradar"."Click"("productId");

-- CreateIndex
CREATE INDEX "Event_type_createdAt_idx" ON "ofertacoradar"."Event"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Event_sessionId_idx" ON "ofertacoradar"."Event"("sessionId");

-- CreateIndex
CREATE INDEX "Event_productId_idx" ON "ofertacoradar"."Event"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "ofertacoradar"."Subscriber"("email");

-- CreateIndex
CREATE INDEX "Subscriber_productId_idx" ON "ofertacoradar"."Subscriber"("productId");

-- CreateIndex
CREATE INDEX "PriceHistory_productId_recordedAt_idx" ON "ofertacoradar"."PriceHistory"("productId", "recordedAt");

-- AddForeignKey
ALTER TABLE "ofertacoradar"."Click" ADD CONSTRAINT "Click_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ofertacoradar"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 2) Indice do kit (manual — nao esta no schema Prisma)
CREATE INDEX IF NOT EXISTS "Product_kit_discount_idx"
  ON "ofertacoradar"."Product" ("discountPct" DESC NULLS LAST)
  WHERE "active" = true;

-- 3) RLS off em todas as tabelas (app usa role própria, sem RLS)
ALTER TABLE "ofertacoradar"."Product" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ofertacoradar"."Brand" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ofertacoradar"."SyncState" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ofertacoradar"."AffiliatedOrg" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ofertacoradar"."TrackedLink" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ofertacoradar"."Click" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ofertacoradar"."Event" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ofertacoradar"."Subscriber" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ofertacoradar"."PriceHistory" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ofertacoradar"."ScriptState" DISABLE ROW LEVEL SECURITY;

-- 4) Grants para a role da aplicação
GRANT USAGE ON SCHEMA "ofertacoradar" TO ofertacoradar_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "ofertacoradar" TO ofertacoradar_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "ofertacoradar" TO ofertacoradar_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA "ofertacoradar"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ofertacoradar_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA "ofertacoradar"
  GRANT USAGE, SELECT ON SEQUENCES TO ofertacoradar_app;

-- 5) search_path: queries raw sem schema ("Product") resolvem certo.
--    Sem isso a home quebra com 42P01 relation "Product" does not exist.
ALTER ROLE ofertacoradar_app SET search_path TO ofertacoradar, public;
ALTER ROLE postgres SET search_path TO ofertacoradar, public;
