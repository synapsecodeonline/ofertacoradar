-- Migracao manual: rodar no SQL Editor do Supabase (o pooler nao aceita
-- db push do Prisma e o usuario do app nao tem DDL). Idempotente.
-- Tabela KV para estado de scripts em ambiente efemero (GitHub Actions):
-- o kit diario guarda aqui o historico de enviados (anti-repeticao 14d).

CREATE TABLE IF NOT EXISTS "ofertacoradar"."ScriptState" (
  "key"   TEXT PRIMARY KEY,
  "value" JSONB NOT NULL
);
