import { prisma } from "../src/lib/db";

// Remove duplicatas do catalogo: mesmo produto entregue pela fonte com
// IDs/SKUs diferentes (externalId e URL distintos). Agrupa por
// familia da fonte + merchant + titulo normalizado e mantem apenas a
// melhor linha ativa; as demais sao desativadas (nunca deletadas —
// preserva historico de cliques).

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function family(externalId: string | null): string {
  return externalId?.split(":")[0] ?? "";
}

async function main() {
  const rows = await prisma.product.findMany({
    where: { active: true },
    select: {
      id: true,
      title: true,
      merchant: true,
      externalId: true,
      imageUrl: true,
      affiliateUrl: true,
      updatedAt: true,
    },
  });
  console.log(`${rows.length} produtos ativos carregados.`);

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${family(r.externalId)}|${(r.merchant ?? "").toLowerCase()}|${norm(r.title)}`;
    if (!r.title || norm(r.title).length < 10) continue;
    const g = groups.get(key) ?? [];
    g.push(r);
    groups.set(key, g);
  }

  const toDisable: number[] = [];
  let groupsFound = 0;
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    groupsFound++;
    // Keeper: prefere quem tem imagem E link de afiliado; desempate
    // pelo updatedAt mais recente (dado mais fresco da fonte)
    g.sort((a, b) => {
      const score = (r: (typeof g)[number]) =>
        (r.imageUrl ? 2 : 0) + (r.affiliateUrl ? 1 : 0);
      const d = score(b) - score(a);
      if (d !== 0) return d;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    for (const r of g.slice(1)) toDisable.push(r.id);
    if (groupsFound <= 5) {
      console.log(`dup [${g.length}x] ${g[0].merchant} | ${g[0].title?.slice(0, 70)}`);
    }
  }

  console.log(`${groupsFound} grupos duplicados, ${toDisable.length} linhas a desativar.`);
  if (toDisable.length === 0) return;

  // desativa em lotes
  for (let i = 0; i < toDisable.length; i += 500) {
    await prisma.product.updateMany({
      where: { id: { in: toDisable.slice(i, i + 500) } },
      data: { active: false },
    });
  }
  const active = await prisma.product.count({ where: { active: true } });
  console.log(`Pronto. Ativos agora: ${active}.`);
}

main().finally(() => prisma.$disconnect());
