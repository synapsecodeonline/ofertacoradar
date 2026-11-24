import { syncPrisma as prisma } from "./db";
import { deadLinkSet } from "./product-purge";
import { decodeEntities, discountPctOf } from "./format";
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

// Retorno para os scrapers mostrarem numeros reais: "created" =
// linha nova, "updated" = ja existia e foi atualizada, "skipped" =
// barrado (URL bloqueada, dado invalido, tombstone de link morto,
// duplicata de titulo de outra fonte).
export type UpsertResult = "created" | "updated" | "skipped";

export async function upsertByExternalId(
  p: NormalizedProduct,
  merchantFallback?: string,
  segment?: string | null,
): Promise<UpsertResult> {
  const merchant = p.merchant ?? merchantFallback ?? null;
  if (
    BLOCKED_URL_PARTS.some(
      (b) => p.url.includes(b) || (p.affiliateUrl ?? "").includes(b),
    ) ||
    (merchant ?? "").toLowerCase().includes(BLOCKED_MERCHANTS[0]) ||
    BLOCKED_IMAGE_HOSTS.some((h) => (p.imageUrl ?? "").includes(h))
  ) {
    return "skipped";
  }
  // Validacao dura: nunca entra invalido na base — url tem que ser
  // http(s), preco (quando informado) positivo, imageUrl (quando
  // informada) http(s). Produto sem imagem passa: cartao tem fallback.
  if (
    !p.url.startsWith("http") ||
    (p.price != null && p.price <= 0) ||
    (p.imageUrl != null && !p.imageUrl.startsWith("http")) ||
    (p.affiliateUrl != null && !p.affiliateUrl.startsWith("http"))
  ) {
    return "skipped";
  }
  // Link morto nao volta: o validador deleta o produto e grava tombstone
  // em ScriptState — sem isso o feed recriaria a cada ciclo.
  if (p.externalId && (await deadLinkSet()).has(p.externalId)) return "skipped";
  // Feeds mandam entidades HTML ("Roup&#xE3;o") — decodifica antes de
  // classificar e de exibir, senao a palavra nunca casa e o usuario
  // ve a entidade crua.
  const title = decodeEntities(p.title);
  const description = p.description ? decodeEntities(p.description) : p.description;
  let category = resolveCategory(p.category, title, merchant, segment, description);
  // Campanha Lomadee sem sinal de produto ("15% OFF na loja X") e uma
  // oferta generica — vai para "ofertas", nao para "outros".
  if (category === "outros" && p.externalId?.startsWith("camp-")) {
    category = "ofertas";
  }
  const data = {
    title,
    description,
    imageUrl: p.imageUrl,
    price: p.price,
    oldPrice: p.oldPrice,
    discountPct: discountPctOf(p),
    category,
    subtype: resolveSubtype(category, title),
    merchant,
    organizationId: p.organizationId ?? null,
    url: p.url,
    affiliateUrl: p.affiliateUrl ?? null,
    couponCode: p.couponCode,
    endsAt: p.endsAt,
    active: true,
  };
  if (!p.externalId) return "skipped";
  // active nao vai no update cego: so reativa quando a URL muda de
  // verdade (link novo = merece recheck). Produto com link morto nem
  // chega aqui — o tombstone em deadLinkSet barra antes.
  const { active: _active, ...rest } = data;
  // updatedAt explicito: a reconciliacao com o feed depende dele
  const touch = { ...rest, updatedAt: new Date() };

  let result: UpsertResult;
  const urlChanged = await prisma.product.updateMany({
    where: { externalId: p.externalId, url: { not: p.url } },
    data: { ...touch, active: true },
  });
  if (urlChanged.count > 0) {
    result = "updated";
  } else {
    const sameUrl = await prisma.product.updateMany({
      where: { externalId: p.externalId, url: p.url },
      data: touch,
    });
    if (sameUrl.count > 0) {
      result = "updated";
    } else {
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
        result = "updated";
      } else {
        // Anti-duplicata CROSS-SOURCE: mesmo título (case-insensitive)
        // já ativo vindo de outra fonte (ex: Lomadee vs ml:). Não cria —
        // o scripts/dedup.ts consolida os casos que escapam da grafia
        // exata (acentos/abreviações) na rotina semanal.
        // Campanhas/cupons (camp-) ficam de fora: "10% de desconto" de
        // lojas diferentes nao e o mesmo produto.
        const crossDupe = p.externalId.startsWith("camp-")
          ? null
          : await prisma.product.findFirst({
          where: {
            active: true,
            title: { equals: title, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (crossDupe) {
          result = "skipped";
        } else {
          await prisma.product.create({
            data: { ...data, externalId: p.externalId },
          });
          result = "created";
        }
      }
    }
  }

  // Historico de preco por produto (tabela PriceHistory apos migracao;
  // fallback: SyncState KV ate la). Leitura na pagina de produto.
  // So grava quando o preco MUDA vs o ultimo registro — antes cada sync
  // inseria 1 linha/produto/dia (~20k/dia) e estourou o disco do
  // Supabase free tier (500MB).
  if (p.price != null && p.externalId) {
    await prisma
      .$executeRaw`
        INSERT INTO "ofertacoradar"."PriceHistory" ("productId", "price")
        SELECT p.id, ${p.price}
        FROM "ofertacoradar"."Product" p
        WHERE p."externalId" = ${p.externalId}
          AND (
            SELECT h.price FROM "ofertacoradar"."PriceHistory" h
            WHERE h."productId" = p.id
            ORDER BY h."recordedAt" DESC, h.id DESC
            LIMIT 1
          ) IS DISTINCT FROM ${p.price}
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
  return result;
}
