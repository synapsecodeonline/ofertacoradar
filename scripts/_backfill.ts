import { prisma } from "../src/lib/db";
import { resolveCategory } from "../src/lib/categories";

async function main() {
  const orgNames = new Map(
    (
      await prisma.affiliatedOrg.findMany({
        select: { organizationId: true, name: true },
      })
    )
      .filter((o) => o.name)
      .map((o) => [o.organizationId, o.name!]),
  );

  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      category: true,
      merchant: true,
      organizationId: true,
    },
  });
  console.log(`${products.length} produtos para revisar`);

  const stats = { cat: 0, merchant: 0 };
  const CONCURRENCY = 10;
  let idx = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (idx < products.length) {
        const p = products[idx++];
        const category = resolveCategory(p.category, p.title);
        const merchant =
          p.merchant ??
          (p.organizationId ? orgNames.get(p.organizationId) : undefined) ??
          null;
        if (category !== p.category || merchant !== p.merchant) {
          await prisma.product.update({
            where: { id: p.id },
            data: { category, merchant },
          });
          if (category !== p.category) stats.cat++;
          if (merchant !== p.merchant) stats.merchant++;
        }
      }
    }),
  );
  console.log(`OK: ${stats.cat} categorias ajustadas, ${stats.merchant} merchants preenchidos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
