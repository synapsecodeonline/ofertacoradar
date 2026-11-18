import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";
import { instagramCaption } from "@/lib/instagram";

export const dynamic = "force-dynamic";

// Kit diário de conteúdo para o Instagram: devolve os produtos mais
// quentes do momento com URLs prontas dos cards (/api/card) e legendas.
// GET /api/instagram/kit?count=10&size=feed|story
// Requer login (mesmo critério do /api/card).
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return Response.json({ error: "Login necessário" }, { status: 401 });
    }
  } catch {
    return Response.json({ error: "Login necessário" }, { status: 401 });
  }

  const url = new URL(req.url);
  const count = Math.min(20, Math.max(1, Number(url.searchParams.get("count")) || 10));
  const size = url.searchParams.get("size") === "story" ? "story" : "feed";

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3_600_000);

  // Ranking: cliques nas últimas 24h primeiro; completa com maiores descontos
  const clicks = await prisma.click.groupBy({
    by: ["productId"],
    where: { createdAt: { gte: dayAgo } },
    _count: { _all: true },
    orderBy: { _count: { productId: "desc" } },
    take: count * 3,
  });
  const clickCount = new Map(clicks.map((c) => [c.productId, c._count._all]));

  const candidates = await prisma.product.findMany({
    where: {
      active: true,
      imageUrl: { not: null },
      discountPct: { gt: 0 },
      AND: [
        { OR: [{ price: null }, { price: { not: 0 } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { discountPct: "desc" },
    take: count * 4,
  });

  const items = candidates
    .map((p) => ({ p, clicks: clickCount.get(p.id) ?? 0 }))
    .sort((a, b) => b.clicks - a.clicks || (b.p.discountPct ?? 0) - (a.p.discountPct ?? 0))
    .slice(0, count)
    .map(({ p, clicks: n }) => ({
      id: p.id,
      title: p.title,
      merchant: p.merchant,
      price: p.price,
      oldPrice: p.oldPrice,
      discountPct: p.discountPct,
      clicks24h: n,
      pageUrl: `${siteUrl()}/produto/${p.id}`,
      cardUrl: `${siteUrl()}/api/card/${p.id}?size=${size}`,
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

  return Response.json({
    generatedAt: now.toISOString(),
    siteUrl: siteUrl(),
    size,
    count: items.length,
    items,
  });
}
