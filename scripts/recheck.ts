import { prisma } from "../src/lib/db";
import { CHECKABLE_PREFIXES, mapLimit, validateProductLink } from "../src/lib/linkcheck";

// Revalida produtos INATIVOS desativados pelo validador: os que voltarem
// ok/unknown sao reativados (falso positivo, ex.: SPA sem <title>);
// os realmente mortos continuam fora.
async function main() {
  const prods = await prisma.product.findMany({
    where: {
      active: false,
      OR: CHECKABLE_PREFIXES.map((pre) => ({ externalId: { startsWith: pre } })),
    },
    select: { id: true, title: true, url: true, affiliateUrl: true, merchant: true, externalId: true },
  });
  console.log(`${prods.length} produtos inativos para revalidar.`);
  const revive: number[] = [];
  let ok = 0, dead = 0, unk = 0;
  await mapLimit(prods, 8, async (p) => {
    const s = await validateProductLink(p);
    if (s === "dead") dead++;
    else if (s === "ok") { ok++; revive.push(p.id); }
    else { unk++; revive.push(p.id); }
  });
  for (let i = 0; i < revive.length; i += 500) {
    await prisma.product.updateMany({
      where: { id: { in: revive.slice(i, i + 500) } },
      data: { active: true },
    });
  }
  console.log(`reativados: ${revive.length} (ok:${ok} inconclusivos:${unk}) | continuam off: ${dead}`);
  await prisma.$disconnect();
}
main();
