import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/search?q=termo — autocomplete da busca: produtos + lojas.
// Leve: so colunas necessarias, limite pequeno, sem filtros pesados.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ products: [], merchants: [] });

  const like = `%${q.slice(0, 80)}%`;
  const [products, merchants] = await Promise.all([
    prisma.product.findMany({
      where: {
        active: true,
        imageUrl: { not: null },
        OR: [
          { title: { contains: q.slice(0, 80), mode: "insensitive" } },
          { merchant: { contains: q.slice(0, 80), mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        title: true,
        price: true,
        imageUrl: true,
        merchant: true,
        discountPct: true,
      },
      orderBy: { discountPct: { sort: "desc", nulls: "last" } },
      take: 6,
    }),
    prisma.product.findMany({
      where: {
        active: true,
        AND: [
          { merchant: { not: null } },
          { merchant: { contains: q.slice(0, 80), mode: "insensitive" } },
        ],
      },
      select: { merchant: true },
      distinct: ["merchant"],
      take: 5,
    }),
  ]);

  return Response.json({
    products,
    merchants: merchants
      .map((m) => m.merchant)
      .filter((m): m is string => !!m),
  });
}
