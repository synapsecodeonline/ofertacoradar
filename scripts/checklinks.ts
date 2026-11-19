import { prisma } from "../src/lib/db";
import {
  CHECKABLE_PREFIXES,
  mapLimit,
  validateProductLink,
} from "../src/lib/linkcheck";

// Varredura unica do catalogo: desativa produtos ativos cujo link do
// parceiro esta morto (404/410 ou pagina "nao encontrada").
// ml: fica de fora — anti-bot do Mercado Livre torna a checagem
// server-side inconclusiva.
// Uso: npm run checklinks

const CONCURRENCY = 8;
const BATCH_LOG = 200;

async function main() {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      OR: CHECKABLE_PREFIXES.map((pre) => ({
        externalId: { startsWith: pre },
      })),
    },
    select: {
      id: true,
      title: true,
      url: true,
      affiliateUrl: true,
      merchant: true,
      externalId: true,
      organizationId: true,
      imageUrl: true,
    },
    orderBy: { id: "asc" },
  });

  console.log(`${products.length} produtos ativos para validar.`);

  let ok = 0;
  let dead = 0;
  let unknown = 0;
  const deadIds: number[] = [];
  const deadSamples: string[] = [];

  const results = await mapLimit(products, CONCURRENCY, async (p, i) => {
    const status = await validateProductLink(p);
    if ((i + 1) % BATCH_LOG === 0) {
      console.log(
        `  ${i + 1}/${products.length} — ok:${ok} mortos:${dead} inconclusivos:${unknown}`,
      );
    }
    if (status === "dead") {
      dead++;
      deadIds.push(p.id);
      if (deadSamples.length < 30) {
        deadSamples.push(`${p.merchant ?? "?"} — ${p.title.slice(0, 60)}`);
      }
    } else if (status === "ok") {
      ok++;
    } else {
      unknown++;
    }
    return status;
  });

  // Desativa mortos em lotes
  const CHUNK = 500;
  for (let i = 0; i < deadIds.length; i += CHUNK) {
    await prisma.product.updateMany({
      where: { id: { in: deadIds.slice(i, i + CHUNK) } },
      data: { active: false },
    });
  }

  console.log("\n=== Resultado ===");
  console.log(`validos:        ${ok}`);
  console.log(`mortos->off:    ${dead}`);
  console.log(`inconclusivos:  ${unknown} (mantidos ativos)`);
  if (deadSamples.length) {
    console.log("\nAmostra dos desativados:");
    for (const s of deadSamples) console.log(`  - ${s}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
