import { prisma } from "../src/lib/db";
import { discountPctOf } from "../src/lib/format";
import { resolveCategory } from "../src/lib/categories";
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
  let orgs: { organizationId: string; name?: string }[] = [];

  if (apiKey) {
    // Campanhas (ofertas/cupons) trazem links lmdee.link ja rastreados = comissao
    console.log("Buscando campanhas/ofertas na Lomadee...");
    const brands = await fetchLomadeeBrands(apiKey, baseUrl);
    const campaigns = await fetchLomadeeCampaigns(apiKey, baseUrl, brands);
    products = campaigns.items;
    orgs = campaigns.orgs;
    console.log(
      `${products.length} ofertas com link de afiliado, ${orgs.length} organizacoes afiliadas.`,
    );

    // Atualiza a lista de marcas que o afiliado pode vender (base p/ aba Produtos)
    await prisma.affiliatedOrg.deleteMany();
    if (orgs.length) {
      await prisma.affiliatedOrg.createMany({
        data: orgs.map((o) => ({
          organizationId: o.organizationId,
          name: o.name,
        })),
      });
    }

    if (importProducts) {
      // Catalogo: so produtos de organizacoes afiliadas e com preco > 0.
      // O link de comissao e gerado no clique via /ir-api (shortener Lomadee).
      console.log("Buscando catalogo de produtos...");
      const affiliated = new Set(orgs.map((o) => o.organizationId));
      const catalog = (await fetchLomadeeProducts(apiKey, baseUrl)).filter(
        (p) =>
          p.organizationId &&
          affiliated.has(p.organizationId) &&
          p.price !== 0,
      );
      for (const p of catalog) {
        p.externalId = `prod:${p.externalId}`;
        // sem link de afiliado pronto: o /ir gera lmdee.link no clique
        p.affiliateUrl = undefined;
      }
      products = products.concat(catalog);
      console.log(
        `${catalog.length} produtos afiliados adicionados ao catalogo.`,
      );
    }
  } else {
    console.log(`Baixando feed: ${feedUrl}`);
    products = await fetchFeed(feedUrl!);
  }
  console.log(`${products.length} itens no total.`);

  const override = process.env.AFFILIATE_URL_OVERRIDE || undefined;
  let processed = 0;
  let failed = 0;

  // Nome da organizacao afiliada serve de merchant quando a fonte nao informa
  const orgNames = new Map(
    orgs.filter((o) => o.name).map((o) => [o.organizationId, o.name!]),
  );

  const upsertOne = async (p: (typeof products)[number]) => {
    const data = {
      title: p.title,
      description: p.description,
      imageUrl: p.imageUrl,
      price: p.price,
      oldPrice: p.oldPrice,
      discountPct: discountPctOf(p),
      category: resolveCategory(p.category, p.title),
      merchant: p.merchant ?? (p.organizationId ? orgNames.get(p.organizationId) : undefined) ?? null,
      organizationId: p.organizationId ?? null,
      url: p.url,
      affiliateUrl: override ?? p.affiliateUrl ?? null,
      couponCode: p.couponCode,
      endsAt: p.endsAt,
      active: true,
    };

    try {
      if (p.externalId) {
        await prisma.product.upsert({
          where: { externalId: p.externalId },
          create: { ...data, externalId: p.externalId },
          update: data,
        });
      } else {
        const existing = await prisma.product.findFirst({ where: { url: p.url } });
        if (existing) {
          await prisma.product.update({ where: { id: existing.id }, data });
        } else {
          await prisma.product.create({ data: { ...data, externalId: null } });
        }
      }
      processed++;
    } catch (e) {
      failed++;
      console.warn(`Falha ao salvar "${p.title?.slice(0, 40)}":`, e);
    }
  };

  // Processa em paralelo para nao estourar o tempo em bancos remotos
  const CONCURRENCY = 5;
  let idx = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (idx < products.length) {
        await upsertOne(products[idx++]);
      }
    }),
  );
  console.log(`${processed} processados, ${failed} falhas.`);

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

  console.log(`OK: ${processed} processados, ${failed} falhas, ${deactivated.count} desativados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
