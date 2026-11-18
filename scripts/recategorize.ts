// Reclassifica category/subtype dos produtos ativos usando o titulo.
// So ATUALIZA quando o novo resultado e uma categoria real (nunca rebaixa
// para "outros"/"ofertas") — preserva categorias vindas de alias/segmento
// da fonte para itens sem sinal no titulo.
// Uso: npm run recategorize  (tsx --env-file=.env scripts/recategorize.ts)
import { prisma } from "../src/lib/db";
import { resolveCategory, resolveSubtype } from "../src/lib/categories";

const SKIP = new Set(["outros", "ofertas"]);

async function main() {
  const rows = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, title: true, merchant: true, category: true },
  });
  const diff = new Map<string, number>();
  const updates: { id: number; cat: string; sub: string | null }[] = [];
  for (const r of rows) {
    const nc = resolveCategory(undefined, r.title, r.merchant);
    if (nc === r.category || SKIP.has(nc)) continue;
    const k = `${r.category ?? "null"} -> ${nc}`;
    diff.set(k, (diff.get(k) ?? 0) + 1);
    updates.push({ id: r.id, cat: nc, sub: resolveSubtype(nc, r.title) });
  }
  console.log(`${rows.length} ativos | ${updates.length} reclassificacoes`);
  [...diff.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(String(v).padStart(5), k));
  if (process.argv.includes("--apply") === false) {
    console.log("\nDry-run. Rode com --apply para gravar.");
    return;
  }
  for (const u of updates) {
    await prisma.product.update({
      where: { id: u.id },
      data: { category: u.cat, subtype: u.sub },
    });
  }
  console.log(`\n${updates.length} produtos atualizados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
