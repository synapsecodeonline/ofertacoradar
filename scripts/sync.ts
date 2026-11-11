import { prisma } from "../src/lib/db";
import {
  fetchFeed,
  fetchLomadeeBrands,
  fetchLomadeeCampaigns,
  fetchLomadeeProducts,
} from "../src/lib/feed";

async function main() {
  const apiKey = process.env.LOMADEE_API_KEY;
  const feedUrl = process.env.FEED_URL;
  if (!apiKey && !feedUrl) {
    console.error(
      "Defina LOMADEE_API_KEY ou FEED_URL no .env com a fonte de ofertas.",
    );
    process.exit(1);
  }

  const baseUrl = process.env.LOMADEE_API_URL || "https://api.lomadee.com.br";
  const importProducts = process.env.LOMADEE_PRODUCTS === "1";
  let products;

  if (apiKey) {
    // Campanhas (ofertas/cupons) trazem links lmdee.link ja rastreados = comissao
    console.log("Buscando campanhas/ofertas na Lomadee...");
    const brands = await fetchLomadeeBrands(apiKey, baseUrl);
    products = await fetchLomadeeCampaigns(apiKey, baseUrl, brands);
    console.log(`${products.length} ofertas com link de afiliado.`);

    if (importProducts) {
      // Catalogo de produtos: links diretos da loja (sem comissao)
      console.log("Buscando catalogo de produtos...");
      const catalog = await fetchLomadeeProducts(apiKey, baseUrl);
      products = products.concat(catalog);
      console.log(`${catalog.length} produtos adicionados ao catalogo.`);
    }
  } else {
    console.log(`Baixando feed: ${feedUrl}`);
    products = await fetchFeed(feedUrl!);
  }
  console.log(`${products.length} itens no total.`);

  const override = process.env.AFFILIATE_URL_OVERRIDE || undefined;
  let created = 0;
  let updated = 0;

  for (const p of products) {
    const data = {
      title: p.title,
      description: p.description,
      imageUrl: p.imageUrl,
      price: p.price,
      oldPrice: p.oldPrice,
      category: p.category,
      merchant: p.merchant,
      url: p.url,
      affiliateUrl: override ?? p.affiliateUrl,
      couponCode: p.couponCode,
      endsAt: p.endsAt,
      active: true,
    };

    const existing = await prisma.product.findFirst({
      where: p.externalId ? { externalId: p.externalId } : { url: p.url },
    });

    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.product.create({
        data: { ...data, externalId: p.externalId ?? null },
      });
      created++;
    }
  }

  // Desativa produtos que sumiram do feed (feed é a fonte da verdade)
  const seenIds = products.map((p) => p.externalId).filter((x): x is string => !!x);
  const seenUrls = products.map((p) => p.url);
  const deactivated = await prisma.product.updateMany({
    where: {
      active: true,
      OR: [
        {
          AND: [
            { externalId: { not: null } },
            { externalId: { notIn: seenIds } },
          ],
        },
        { externalId: null, url: { notIn: seenUrls } },
      ],
    },
    data: { active: false },
  });

  console.log(`OK: ${created} criados, ${updated} atualizados, ${deactivated.count} desativados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
