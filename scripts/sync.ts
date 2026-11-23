import { prisma } from "../src/lib/db";
import { purgeProducts, deadLinkSet } from "../src/lib/product-purge";
import { decodeEntities, discountPctOf } from "../src/lib/format";
import { resolveCategory, resolveSubtype } from "../src/lib/categories";
import {
  fetchFeed,
  fetchLomadeeBrands,
  fetchLomadeeCampaigns,
  fetchLomadeeProducts,
} from "../src/lib/feed";
import { fetchMercadoLivreAll } from "../src/lib/mercadolivre";

async function main() {
  const apiKey = process.env.LOMADEE_API_KEY;
  const feedUrl = process.env.FEED_URL;
  if (!apiKey && !feedUrl && !process.env.ML_CLIENT_ID) {
    console.error(
      "Defina LOMADEE_API_KEY, FEED_URL ou ML_CLIENT_ID no .env com a fonte de ofertas.",
    );
    process.exit(1);
  }

  const baseUrl = process.env.LOMADEE_API_URL || "https://api.lomadee.com.br";
  const importProducts = process.env.LOMADEE_PRODUCTS === "1";
  let products: import("../src/lib/feed").NormalizedProduct[] = [];
  let orgs: { organizationId: string; name?: string }[] = [];
  let brandSegments = new Map<string, string | undefined>();

  if (apiKey) {
    // Campanhas (ofertas/cupons) trazem links lmdee.link ja rastreados = comissao
    console.log("Buscando campanhas/ofertas na Lomadee...");
    const brands = await fetchLomadeeBrands(apiKey, baseUrl);
    // segment Lomadee por organizationId — sinal de vertical da loja
    // usado na classificação (brand.id == organizationId do produto)
    brandSegments = new Map(
      [...brands.values()].map((b) => [b.id, b.segment]),
    );
    const campaigns = await fetchLomadeeCampaigns(apiKey, baseUrl, brands);
    products = campaigns.items;
    orgs = campaigns.orgs;
    console.log(
      `${products.length} ofertas com link de afiliado, ${orgs.length} organizacoes afiliadas.`,
    );

    // Atualiza a lista de marcas que o afiliado pode vender (base p/ aba Produtos)
    await prisma.affiliatedOrg.deleteMany();
    if (orgs.length) {
      // Lomadee repete organizationId entre campanhas — dedup antes do
      // createMany ou estoura a unique constraint.
      const seenOrgs = new Set<string>();
      await prisma.affiliatedOrg.createMany({
        data: orgs
          .filter((o) => !seenOrgs.has(o.organizationId) && seenOrgs.add(o.organizationId))
          .map((o) => ({
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
        p.externalId = `prod-lomadee:${p.externalId}`;
        // sem link de afiliado pronto: o /ir gera lmdee.link no clique
        p.affiliateUrl = undefined;
      }
      products = products.concat(catalog);
      console.log(
        `${catalog.length} produtos afiliados adicionados ao catalogo.`,
      );
    }
  } else if (feedUrl) {
    console.log(`Baixando feed: ${feedUrl}`);
    products = await fetchFeed(feedUrl!);
  }

  let mlSynced = false;
  if (process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET) {
    console.log("Buscando produtos no Mercado Livre...");
    const ml = await fetchMercadoLivreAll();
    products = products.concat(ml);
    mlSynced = true;
    console.log(`${ml.length} produtos do Mercado Livre adicionados.`);
  }
  // Cotas por fonte — o catalogo fica balanceado e estavel em ~10k
  // produtos (disco Supabase free = 500MB). Itens alem da cota nao
  // entram em `products`, logo nao sao vistos como "presentes" e sao
  // desativados — a cada sync os mesmos top-N se mantem.
  // Override por fonte: SYNC_QUOTA_LOMADEE / _ML / _AWIN / _AMAZON
  const QUOTAS: Record<string, number> = {
    lomadee: Number(process.env.SYNC_QUOTA_LOMADEE ?? 5000),
    ml: Number(process.env.SYNC_QUOTA_ML ?? 5000),
    awin: Number(process.env.SYNC_QUOTA_AWIN ?? 1000),
    amazon: Number(process.env.SYNC_QUOTA_AMAZON ?? 500),
  };
  const familyOf = (p: (typeof products)[number]) => {
    const id = p.externalId ?? "";
    if (id.startsWith("ml:")) return "ml";
    if (id.startsWith("aw:")) return "awin";
    if (id.startsWith("amz:")) return "amazon";
    if (id.startsWith("camp-") || id.startsWith("prod-lomadee:")) return "lomadee";
    return "feed";
  };
  const byFamily = new Map<string, typeof products>();
  for (const p of products) {
    const f = familyOf(p);
    const list = byFamily.get(f) ?? [];
    list.push(p);
    byFamily.set(f, list);
  }
  products = [...byFamily.entries()].flatMap(([f, list]) => {
    const cap = QUOTAS[f] ?? Number(process.env.SYNC_QUOTA_FEED ?? 2000);
    if (list.length > cap) {
      console.log(`[sync] cota ${f}: ${list.length} → ${cap} itens`);
      return list.slice(0, cap);
    }
    return list;
  });
  console.log(`${products.length} itens no total (apos cotas).`);

  const override = process.env.AFFILIATE_URL_OVERRIDE || undefined;
  let processed = 0;
  let failed = 0;

  // Nome da organizacao afiliada serve de merchant quando a fonte nao informa
  const orgNames = new Map(
    orgs.filter((o) => o.name).map((o) => [o.organizationId, o.name!]),
  );

  const deadSet = await deadLinkSet();
  const upsertOne = async (p: (typeof products)[number]) => {
    if (p.externalId && deadSet.has(p.externalId)) return;
    const merchant =
      p.merchant ?? (p.organizationId ? orgNames.get(p.organizationId) : undefined) ?? null;
    const title = decodeEntities(p.title);
    const description = p.description ? decodeEntities(p.description) : p.description;
    let category = resolveCategory(
      p.category,
      title,
      merchant,
      p.organizationId ? brandSegments.get(p.organizationId) : undefined,
      description,
    );
    if (category === "outros" && p.externalId?.startsWith("camp-")) {
      category = "ofertas";
    }
    const data = {
      title,
      description,
      imageUrl: p.imageUrl,
      price: p.price,
      oldPrice: p.oldPrice,
      discountPct: discountPctOf(p),
      category,
      subtype: resolveSubtype(category, title),
      merchant,
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

  // Remove produtos que sumiram da fonte — cada fonte e a verdade so do
  // seu proprio prefixo (ml: nao pode derrubar Lomadee/feed e vice-versa).
  const seenIds = products.map((p) => p.externalId).filter((x): x is string => !!x);
  const seenUrls = products.map((p) => p.url);
  let removedCount = 0;

  if (apiKey || feedUrl) {
    const nonMlSeen = seenIds.filter((id) => !id.startsWith("ml:"));
    removedCount += await purgeProducts({
      active: true,
      OR: [
        {
          AND: [
            { externalId: { not: null } },
            { NOT: { externalId: { startsWith: "ml:" } } },
            { externalId: { notIn: nonMlSeen } },
          ],
        },
        { externalId: null, url: { notIn: seenUrls } },
      ],
    });
  }

  if (mlSynced) {
    const mlSeen = seenIds.filter((id) => id.startsWith("ml:"));
    removedCount += await purgeProducts({
      active: true,
      externalId: { startsWith: "ml:" },
      NOT: { externalId: { in: mlSeen } },
    });
  }

  console.log(`OK: ${processed} processados, ${failed} falhas, ${removedCount} removidos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
