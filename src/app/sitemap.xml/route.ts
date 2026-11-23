import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { SITEMAP_PAGE_SIZE } from "@/lib/sitemap";
import { memoTtl } from "@/lib/memo";

export const dynamic = "force-dynamic";

// Sitemap index: o urlset unico passava de 3.7MB / 22k URLs e o
// Search Console falhava ao buscar. Agora /sitemap.xml lista os
// sub-sitemaps — paginas estaticas + produtos paginados.

export async function GET() {
  const xml = await memoTtl("sitemap-index", 10 * 60_000, async () => {
  const base = siteUrl();
  const total = await prisma.product.count({ where: { active: true } });
  const pages = Math.max(1, Math.ceil(total / SITEMAP_PAGE_SIZE));
  const children = [
    `${base}/sitemaps/pages`,
    ...Array.from({ length: pages }, (_, i) => `${base}/sitemaps/produtos/${i}`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${children.map((u) => `  <sitemap><loc>${u}</loc></sitemap>`).join("\n")}
</sitemapindex>`;
  return xml;
  });
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
