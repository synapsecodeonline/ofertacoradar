import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { SITEMAP_PAGE_SIZE } from "@/lib/sitemap";
import { memoTtl } from "@/lib/memo";

export const dynamic = "force-dynamic";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Sub-sitemap de produtos: /sitemaps/produtos/0, /1, ... cada um com
// no maximo SITEMAP_PAGE_SIZE URLs (limite do protocolo e 50k, mas
// paginas menores indexam mais rapido e falham menos).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ page: string }> },
) {
  const { page } = await params;
  const n = Math.max(0, Number.parseInt(page, 10) || 0);
  const xml = await memoTtl(`sitemap-prod:${n}`, 30 * 60_000, async () => {
  const base = siteUrl();
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    skip: n * SITEMAP_PAGE_SIZE,
    take: SITEMAP_PAGE_SIZE,
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${products
  .map(
    (p) => `  <url>
    <loc>${esc(`${base}/produto/${p.id}`)}</loc>
    <lastmod>${p.updatedAt.toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;
  return xml;
  });
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
