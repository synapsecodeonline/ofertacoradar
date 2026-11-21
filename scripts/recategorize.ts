// Reclassifica category/subtype dos produtos ativos usando titulo,
// descricao e merchant. Decodifica entidades HTML nos titulos
// ("Roup&#xE3;o" -> "Roupão") — entidade quebrava o casamento de
// palavras e o produto caia em "outros".
// So ATUALIZA quando o novo resultado e uma categoria real (nunca
// rebaixa para "outros"/"ofertas"), EXCETO campanha Lomadee sem
// sinal de produto que vai para "ofertas".
// Uso: npm run recategorize  (tsx --env-file=.env scripts/recategorize.ts)
import { prisma } from "../src/lib/db";
import { resolveCategory, resolveSubtype } from "../src/lib/categories";
import { decodeEntities } from "../src/lib/format";

const SKIP = new Set(["outros", "ofertas"]);

async function main() {
  const rows = await prisma.product.findMany({
    where: { active: true },
    select: {
      id: true,
      title: true,
      description: true,
      merchant: true,
      category: true,
      externalId: true,
    },
  });
  const diff = new Map<string, number>();
  const updates: {
    id: number;
    cat: string | null;
    sub: string | null;
    title?: string;
  }[] = [];
  let fixedTitles = 0;
  for (const r of rows) {
    const title = decodeEntities(r.title);
    if (title !== r.title) fixedTitles++;
    // A categoria atual vai como `raw`: titulo continua tendo prioridade,
    // mas categoria existente so perde para a descricao quando titulo e
    // loja nao dizem nada (evita reclassificar "Cabo Flexivel" de
    // construcao para "servicos" por causa de texto de marketing).
    let nc = resolveCategory(r.category, title, r.merchant, undefined, r.description);
    // Campanha Lomadee sem sinal de produto vai para "ofertas"; qualquer
    // outro rebaixamento para "outros"/"ofertas" e bloqueado.
    const isCampOutros = nc === "outros" && r.externalId?.startsWith("camp-");
    if (isCampOutros) nc = "ofertas";
    const downgrade =
      nc === "outros" || (nc === "ofertas" && !isCampOutros);
    const catChanged = nc !== r.category && !downgrade;
    const titleChanged = title !== r.title;
    if (!catChanged && !titleChanged) continue;
    if (catChanged) {
      const k = `${r.category ?? "null"} -> ${nc}`;
      diff.set(k, (diff.get(k) ?? 0) + 1);
    }
    updates.push({
      id: r.id,
      cat: catChanged ? nc : null,
      sub: catChanged ? resolveSubtype(nc, title) : null,
      title: titleChanged ? title : undefined,
    });
  }
  console.log(
    `${rows.length} ativos | ${updates.length} atualizacoes (${fixedTitles} titulos com entidades)`,
  );
  [...diff.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(String(v).padStart(5), k));
  if (!process.argv.includes("--apply")) {
    console.log("\nDry-run. Rode com --apply para gravar.");
    return;
  }
  for (const u of updates) {
    await prisma.product.update({
      where: { id: u.id },
      data: {
        ...(u.title !== undefined ? { title: u.title } : {}),
        ...(u.cat !== null
          ? { category: u.cat, subtype: u.sub }
          : {}),
      },
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
