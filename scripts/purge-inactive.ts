import { prisma } from "../src/lib/db";
import { purgeProducts } from "../src/lib/product-purge";

// One-off/manutencao: remove todos os produtos active=false que sobraram
// da era "desativar em vez de deletar". Uso: npx tsx --env-file=.env scripts/purge-inactive.ts
async function main() {
  const inactive = await prisma.product.count({ where: { active: false } });
  console.log(`${inactive} produtos inativos para remover.`);
  if (inactive === 0) return;
  const removed = await purgeProducts({ active: false });
  const left = await prisma.product.count({ where: { active: false } });
  console.log(`Removidos: ${removed}. Inativos restantes: ${left}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
