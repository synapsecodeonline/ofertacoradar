import { syncPrisma as prisma } from "./db";
import type { Prisma } from "@prisma/client";

// "Desativar" produto = deletar a linha. A base so tem produtos ativos:
// Clicks saem em cascade (FK onDelete), PriceHistory nao tem FK e e
// apagado aqui antes. Event/Subscriber ficam orfaos de proposito
// (productId e Int? sem relacao — analytics/retencao cuidam deles).
//
// Link morto tambem grava tombstone em ScriptState ("dead-links"):
// sem isso o proximo ciclo do feed recriaria o produto e ele voltaria
// ao ar ate o validador de links demorar a rotação chegar nele de novo.

const DEAD_KEY = "dead-links";
const DEAD_CAP = 20000;
const CHUNK = 500;
const CACHE_TTL = 5 * 60_000;

let deadCache: { at: number; set: Set<string> } | null = null;

export async function deadLinkSet(): Promise<Set<string>> {
  if (deadCache && Date.now() - deadCache.at < CACHE_TTL) return deadCache.set;
  const row = await prisma.scriptState.findUnique({ where: { key: DEAD_KEY } });
  const arr = Array.isArray(row?.value) ? (row.value as string[]) : [];
  deadCache = { at: Date.now(), set: new Set(arr) };
  return deadCache.set;
}

export async function markDeadLinks(externalIds: (string | null)[]) {
  const clean = externalIds.filter((x): x is string => !!x);
  if (clean.length === 0) return;
  const row = await prisma.scriptState.findUnique({ where: { key: DEAD_KEY } });
  const arr = Array.isArray(row?.value) ? [...(row.value as string[])] : [];
  const set = new Set(arr);
  for (const id of clean) set.add(id);
  const merged = [...set].slice(-DEAD_CAP);
  await prisma.scriptState.upsert({
    where: { key: DEAD_KEY },
    create: { key: DEAD_KEY, value: merged },
    update: { value: merged },
  });
  deadCache = null;
}

async function purgeIds(ids: number[]) {
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    await prisma.priceHistory
      .deleteMany({ where: { productId: { in: slice } } })
      .catch(() => {});
    await prisma.product.deleteMany({ where: { id: { in: slice } } });
  }
  return ids.length;
}

export async function purgeProductsByIds(ids: number[]) {
  if (ids.length === 0) return 0;
  return purgeIds(ids);
}

export async function purgeProducts(where: Prisma.ProductWhereInput) {
  const rows = await prisma.product.findMany({
    where,
    select: { id: true },
  });
  return purgeIds(rows.map((r) => r.id));
}
