import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { instagramCaption } from "@/lib/instagram";

export type KitItem = {
  id: number;
  title: string;
  merchant: string | null;
  price: number | null;
  oldPrice: number | null;
  currency: string;
  discountPct: number | null;
  couponCode: string | null;
  category: string | null;
  clicks24h: number;
  pageUrl: string;
  cardUrl: string;
  cardStoryUrl: string;
  caption: string;
};

// Kit de ofertas para Instagram: mais clicadas nas ultimas 24h,
// completando com maiores descontos. Compartilhado entre
// /api/instagram/kit (JSON) e /admin/kit (pagina visual).
export async function getInstagramKit(
  count = 10,
): Promise<{ generatedAt: string; siteUrl: string; items: KitItem[] }> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3_600_000);
  const n = Math.min(20, Math.max(1, count));

  const clicks = await prisma.click.groupBy({
    by: ["productId"],
    where: { createdAt: { gte: dayAgo } },
    _count: { _all: true },
    orderBy: { _count: { productId: "desc" } },
    take: n * 3,
  });
  const clickCount = new Map(clicks.map((c) => [c.productId, c._count._all]));

  const candidates = await prisma.product.findMany({
    where: {
      active: true,
      imageUrl: { not: null },
      discountPct: { gt: 0 },
      AND: [
        { OR: [{ price: null }, { price: { not: 0 } }] },
        // So ofertas sem data de expiracao — post nao pode promover
        // oferta que morre antes do publico ver
        { endsAt: null },
      ],
    },
    orderBy: { discountPct: "desc" },
    take: n * 4,
  });

  const items: KitItem[] = candidates
    .map((p) => ({ p, clicks: clickCount.get(p.id) ?? 0 }))
    .sort(
      (a, b) =>
        b.clicks - a.clicks || (b.p.discountPct ?? 0) - (a.p.discountPct ?? 0),
    )
    .slice(0, n)
    .map(({ p, clicks: c }) => ({
      id: p.id,
      title: p.title,
      merchant: p.merchant,
      price: p.price,
      oldPrice: p.oldPrice,
      currency: p.currency,
      discountPct: p.discountPct,
      couponCode: p.couponCode,
      category: p.category,
      clicks24h: c,
      pageUrl: `${siteUrl()}/produto/${p.id}`,
      cardUrl: `${siteUrl()}/api/card/${p.id}?size=feed`,
      cardStoryUrl: `${siteUrl()}/api/card/${p.id}?size=story`,
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
    }));

  return { generatedAt: now.toISOString(), siteUrl: siteUrl(), items };
}
