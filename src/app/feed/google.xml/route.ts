import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { brandFromTitle } from "@/lib/brands";
import { memoTtl } from "@/lib/memo";

export const dynamic = "force-dynamic";

// Feed RSS 2.0 + namespace Google Shopping (g:).
// Consumido por Google Merchant Center / Facebook Commerce etc.
// Link aponta para /produto/[id] (pagina canonica com CTA de afiliado).
const esc = (s: string) =>
  s
    // Remove chars de controle invalidos em XML 1.0 (bell, etc.) —
    // titles/descricoes de feeds de afiliado trazem lixo que quebra
    // o parse do Merchant Center.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function GET() {
  // Feed inteiro (~25k produtos com descricao) — caro de gerar e de
  // servir; cache de 1h em memoria evita reconsultar o banco a cada
  // hit de crawler/Merchant Center.
  const xml = await memoTtl("feed-google", 60 * 60_000, async () => {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      imageUrl: { not: null },
      price: { gt: 0 },
      OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
    },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      price: true,
      oldPrice: true,
      currency: true,
      merchant: true,
      category: true,
      couponCode: true,
      endsAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 25000,
  });

  const base = siteUrl();
  const items = products
    .map((p) => {
      const link = `${base}/produto/${p.id}`;
      const cur = p.currency || "BRL";
      // Semantica Google: price = preco cheio (oldPrice quando ha
      // desconto), sale_price = preco promocional atual. Sem oldPrice,
      // price ja e o valor cobrado.
      const hasSale = !!(p.oldPrice && p.oldPrice > p.price!);
      const regular = hasSale ? p.oldPrice! : p.price!;
      const price = `${regular.toFixed(2)} ${cur}`;
      const salePrice = `${p.price!.toFixed(2)} ${cur}`;
      const brand =
        brandFromTitle(p.title) ?? p.merchant ?? "Ofertaço Radar";
      return `    <item>
      <g:id>${p.id}</g:id>
      <title>${esc(p.title.slice(0, 150))}</title>
      <description>${esc((p.description ?? p.title).slice(0, 5000))}</description>
      <link>${esc(link)}</link>
      <g:image_link>${esc(p.imageUrl!)}</g:image_link>
      <g:price>${esc(price)}</g:price>
      ${hasSale ? `<g:sale_price>${esc(salePrice)}</g:sale_price>` : ""}
      <g:availability>in_stock</g:availability>
      <g:brand>${esc(brand)}</g:brand>
      <g:product_type>${esc(p.category ?? "ofertas")}</g:product_type>
      ${p.couponCode ? `<g:coupon_code>${esc(p.couponCode)}</g:coupon_code>` : ""}
      <g:condition>new</g:condition>
      <g:identifier_exists>false</g:identifier_exists>
      <g:updated_at>${p.updatedAt.toISOString()}</g:updated_at>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Ofertaço Radar — Ofertas e Produtos</title>
    <link>${esc(base)}</link>
    <description>Catálogo de ofertas e produtos com links de afiliado verificados diariamente.</description>
${items}
  </channel>
</rss>`;
  return xml;
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
