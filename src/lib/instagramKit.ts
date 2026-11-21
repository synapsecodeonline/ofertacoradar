import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { instagramCaption } from "@/lib/instagram";
import { canonicalCategory } from "@/lib/categories";
import type { Product, Prisma } from "@prisma/client";

export type KitItem = {
  id: number;
  title: string;
  imageUrl: string | null;
  merchant: string | null;
  price: number | null;
  oldPrice: number | null;
  currency: string;
  discountPct: number | null;
  couponCode: string | null;
  category: string | null;
  clicks: number;
  pageUrl: string;
  cardUrl: string;
  cardStoryUrl: string;
  caption: string;
};

// Ofertas elegiveis para kit: ativas, com imagem, desconto > 0,
// preco valido e sem data de expiracao (post nao pode promover
// oferta que morre antes do publico ver).
const KIT_WHERE: Prisma.ProductWhereInput = {
  active: true,
  imageUrl: { not: null },
  discountPct: { gt: 0 },
  AND: [
    { OR: [{ price: null }, { price: { not: 0 } }] },
    { endsAt: null },
  ],
};

function toKitItem(p: Product, c: number, site: string): KitItem {
  return {
    id: p.id,
    title: p.title,
    imageUrl: p.imageUrl,
    merchant: p.merchant,
    price: p.price,
    oldPrice: p.oldPrice,
    currency: p.currency,
    discountPct: p.discountPct,
    couponCode: p.couponCode,
    category: p.category,
    clicks: c,
    pageUrl: `${site}/produto/${p.id}`,
    cardUrl: `${site}/api/card/${p.id}?size=feed`,
    cardStoryUrl: `${site}/api/card/${p.id}?size=story`,
    caption: instagramCaption({
      title: p.title,
      price: p.price,
      oldPrice: p.oldPrice,
      currency: p.currency,
      merchant: p.merchant,
      couponCode: p.couponCode,
      discountPct: p.discountPct,
      category: p.category,
    }),
  };
}

// Janela de popularidade do kit: 7 dias. Cliques de 24h sao ruido —
// produto conhecido tem tracao constante e nao pode depender de ter
// sido clicado hoje para aparecer.
const CLICK_WINDOW_DAYS = 7;

// Pool tematico: varre os produtos elegiveis com maior desconto e
// filtra pela categoria canonica. O pool geral ordena por cliques e
// so pega o top — nichos (esporte, pets...) nunca apareciam no kit
// diario e o tema da semana saía com a categoria errada.
export async function getThemedPool(
  cats: string[],
  limit = 40,
): Promise<KitItem[]> {
  if (cats.length === 0) return [];
  const dayAgo = new Date(Date.now() - CLICK_WINDOW_DAYS * 24 * 3_600_000);
  const candidates = await prisma.product.findMany({
    where: KIT_WHERE,
    orderBy: { discountPct: "desc" },
    take: 2500,
  });
  const ids = candidates.map((p) => p.id);
  const clicks = await prisma.click.groupBy({
    by: ["productId"],
    where: { productId: { in: ids }, createdAt: { gte: dayAgo } },
    _count: { _all: true },
  });
  const clickCount = new Map(clicks.map((c) => [c.productId, c._count._all]));
  const site = siteUrl();

  return candidates
    .filter((p) => cats.includes(canonicalCategory(p.category)))
    .map((p) => ({ p, clicks: clickCount.get(p.id) ?? 0 }))
    .sort(
      (a, b) =>
        b.clicks - a.clicks || (b.p.discountPct ?? 0) - (a.p.discountPct ?? 0),
    )
    .slice(0, limit)
    .map(({ p, clicks: c }) => toKitItem(p, c, site));
}

// Kit de ofertas para Instagram: mais clicadas nos ultimos 7 dias,
// completando com maiores descontos. Compartilhado entre
// /api/instagram/kit (JSON) e /admin/kit (pagina visual).
async function buildKit(count: number, takeMult: number) {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - CLICK_WINDOW_DAYS * 24 * 3_600_000);
  const n = Math.min(200, Math.max(1, count));

  const clicks = await prisma.click.groupBy({
    by: ["productId"],
    where: { createdAt: { gte: dayAgo } },
    _count: { _all: true },
    orderBy: { _count: { productId: "desc" } },
    take: n * 3,
  });
  const clickCount = new Map(clicks.map((c) => [c.productId, c._count._all]));

  const candidates = await prisma.product.findMany({
    where: KIT_WHERE,
    orderBy: { discountPct: "desc" },
    take: n * takeMult,
  });

  const items: KitItem[] = candidates
    .map((p) => ({ p, clicks: clickCount.get(p.id) ?? 0 }))
    .sort(
      (a, b) =>
        b.clicks - a.clicks || (b.p.discountPct ?? 0) - (a.p.discountPct ?? 0),
    )
    .slice(0, n)
    .map(({ p, clicks: c }) => toKitItem(p, c, siteUrl()));

  return { generatedAt: now.toISOString(), siteUrl: siteUrl(), items };
}

export function getInstagramKit(
  count = 10,
): Promise<{ generatedAt: string; siteUrl: string; items: KitItem[] }> {
  const n = Math.min(20, Math.max(1, count));
  return buildKit(n, 4);
}

// Pool amplo para o kit diario: precisa cobrir varias categorias
// para o cronograma semanal ter ofertas de cada tema.
export function getInstagramPool(
  limit = 80,
): Promise<{ generatedAt: string; siteUrl: string; items: KitItem[] }> {
  return buildKit(limit, 4);
}
