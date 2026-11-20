import { syncPrisma as prisma } from "./db";
import { discountPctOf } from "./format";
import { resolveCategory, resolveSubtype } from "./categories";
import type { NormalizedProduct } from "./feed";

// Upsert compartilhado por todas as fontes de afiliado
// (Lomadee prod:/camp:, ML ml:, Awin aw:, Amazon amz:).

// Bloqueio manual de lojistas: produto dessas URLs nem entra no banco.
// Rovitex: catalogo desatualizado na Lomadee, links quebram no site
// deles — bloqueado ate o usuario dar o sinal.
const BLOCKED_URL_PARTS = ["rovitex.com.br"];
const BLOCKED_MERCHANTS = ["rovitex"];
// CDNs de imagem mortos (conta VTEX inativa): produto com imagem quebrada
// nem entra no catalogo. Remover quando a VTEX reativar as contas.
const BLOCKED_IMAGE_HOSTS = [
  "vestis.vteximg.com.br",
  "shopinfo.vteximg.com.br",
];

export async function upsertByExternalId(
  p: NormalizedProduct,
  merchantFallback?: string,
  segment?: string | null,
) {
  const merchant = p.merchant ?? merchantFallback ?? null;
  if (
    BLOCKED_URL_PARTS.some(
      (b) => p.url.includes(b) || (p.affiliateUrl ?? "").includes(b),
    ) ||
    (merchant ?? "").toLowerCase().includes(BLOCKED_MERCHANTS[0]) ||
    BLOCKED_IMAGE_HOSTS.some((h) => (p.imageUrl ?? "").includes(h))
  ) {
    return;
  }
  const category = resolveCategory(p.category, p.title, merchant, segment);
  const data = {
    title: p.title,
    description: p.description,
    imageUrl: p.imageUrl,
    price: p.price,
    oldPrice: p.oldPrice,
    discountPct: discountPctOf(p),
    category,
    subtype: resolveSubtype(category, p.title),
    merchant,
    organizationId: p.organizationId ?? null,
    url: p.url,
    affiliateUrl: p.affiliateUrl ?? null,
    couponCode: p.couponCode,
    endsAt: p.endsAt,
    active: true,
  };
  if (!p.externalId) return;
  // active nao vai no update cego: produto desativado pelo validador de
  // links (link morto) nao pode voltar so porque o feed ainda lista.
  // So reativa quando a URL muda de verdade (link novo = merece recheck).
  const { active: _active, ...rest } = data;
  // updatedAt explicito: a reconciliacao com o feed depende dele
  const touch = { ...rest, updatedAt: new Date() };
  const urlChanged = await prisma.product.updateMany({
    where: { externalId: p.externalId, url: { not: p.url } },
    data: { ...touch, active: true },
  });
  if (urlChanged.count === 0) {
    const sameUrl = await prisma.product.updateMany({
      where: { externalId: p.externalId, url: p.url },
      data: touch,
    });
    if (sameUrl.count === 0) {
      // Anti-duplicata: a Lomadee entrega o mesmo produto com SKUs/IDs
      // diferentes (externalId novo, URL diferente). Se ja existe produto
      // ativo da mesma fonte+loja+titulo, atualiza ele em vez de criar.
      const family = p.externalId.split(":")[0];
      const dupe = await prisma.product.findFirst({
        where: {
          active: true,
          merchant,
          title: p.title,
          externalId: { startsWith: `${family}:` },
        },
        select: { id: true },
      });
      if (dupe) {
        await prisma.product.update({
          where: { id: dupe.id },
          data: touch,
        });
      } else {
        await prisma.product.create({
          data: { ...data, externalId: p.externalId },
        });
      }
    }
  }

  // Historico de preco por produto (tabela PriceHistory apos migracao;
  // fallback: SyncState KV ate la). Leitura na pagina de produto.
  if (p.price != null && p.externalId) {
    await prisma
      .$executeRaw`
        INSERT INTO "ofertacoradar"."PriceHistory" ("productId", "price")
        SELECT id, ${p.price} FROM "ofertacoradar"."Product"
        WHERE "externalId" = ${p.externalId}
      `
      .catch(() => {});
    await prisma
      .$executeRaw`
        INSERT INTO "ofertacoradar"."SyncState" (key, phase)
        VALUES (${`lp:${p.externalId}`}, ${String(p.price)})
        ON CONFLICT (key) DO UPDATE SET
          phase = LEAST("SyncState".phase::numeric, EXCLUDED.phase::numeric)::text
      `
      .catch(() => {});
  }
}
