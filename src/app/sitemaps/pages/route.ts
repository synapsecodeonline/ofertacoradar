import { siteUrl } from "@/lib/site";
import { CATEGORY_ORDER } from "@/lib/categories";
import { memoTtl } from "@/lib/memo";

export const dynamic = "force-dynamic";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Sub-sitemap das rotas estaticas + landing pages de categoria.
export async function GET() {
  const xml = await memoTtl("sitemap-pages", 60 * 60_000, async () => {
  const base = siteUrl();
  const urls: { loc: string; changefreq: string; priority: number }[] = [
    { loc: `${base}/`, changefreq: "hourly", priority: 0.9 },
    { loc: `${base}/?aba=cupons`, changefreq: "hourly", priority: 0.8 },
    { loc: `${base}/ofertas`, changefreq: "hourly", priority: 0.7 },
    { loc: `${base}/politica-de-devolucao`, changefreq: "yearly", priority: 0.3 },
    { loc: `${base}/politica-de-privacidade`, changefreq: "yearly", priority: 0.3 },
    ...CATEGORY_ORDER.map((c) => ({
      loc: `${base}/categoria/${c}`,
      changefreq: "daily",
      priority: 0.7,
    })),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${esc(u.loc)}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
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
