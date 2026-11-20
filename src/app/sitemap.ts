import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { CATEGORY_ORDER } from "@/lib/categories";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${base}/?aba=cupons`,
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${base}/ofertas`,
      changeFrequency: "hourly",
      priority: 0.7,
    },
    {
      url: `${base}/politica-de-devolucao`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/politica-de-privacidade`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    // Landing pages de categoria (SEO)
    ...CATEGORY_ORDER.map((c) => ({
      url: `${base}/categoria/${c}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];

  // Limite do sitemap e 50 mil URLs — pegamos todos os produtos ativos.
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 45000,
  });

  return [
    ...staticRoutes,
    ...products.map((p) => ({
      url: `${base}/produto/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
