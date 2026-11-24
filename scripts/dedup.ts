import { prisma } from "../src/lib/db";
import { purgeProductsByIds } from "../src/lib/product-purge";

// Remove duplicatas do catalogo INTEIRO — mesma oferta vinda de fontes
// diferentes (Lomadee prod:/camp:, ml:, aw:, amz:) ou da mesma fonte com
// IDs/SKUs diferentes. Regra do projeto: a base so tem produtos unicos.
//
// Agrupamento: titulo normalizado (sem acento/caixa/pontuacao) + cluster
// de preco (±20%) — mesmo título com preços muito diferentes pode ser
// variante/modelo distinto e NAO e deduplicado.
// Keeper: melhor score (imagem + affiliateUrl + prioridade de fonte com
// comissao propria) e, em empate, o updatedAt mais recente.
// As removidas sao deletadas (base so tem ativos); o externalId delas
// nao vai pro tombstone — se a fonte reenviar, o upsert atualiza o
// keeper em vez de recriar.

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Fontes com comissao direta valem mais que feed generico da Lomadee.
function sourceScore(externalId: string | null): number {
  const f = externalId?.split(":")[0] ?? "";
  if (f === "ml" || f === "amz") return 3;
  if (f === "aw" || f === "camp-lomadee") return 2;
  return 1;
}

async function main() {
  const rows = await prisma.product.findMany({
    where: { active: true },
    select: {
      id: true,
      title: true,
      price: true,
      merchant: true,
      externalId: true,
      imageUrl: true,
      affiliateUrl: true,
      updatedAt: true,
    },
  });
  console.log(`${rows.length} produtos ativos carregados.`);

  const byTitle = new Map<string, typeof rows>();
  for (const r of rows) {
    let key = norm(r.title);
    if (key.length < 10) continue;
    // Cupons/campanhas (camp-) so deduplicam dentro da mesma loja —
    // "10% de desconto" da Loja A e da Loja B sao ofertas diferentes.
    if (r.externalId?.startsWith("camp-")) {
      key += `|${norm(r.merchant)}`;
    }
    const g = byTitle.get(key) ?? [];
    g.push(r);
    byTitle.set(key, g);
  }

  const toRemove: number[] = [];
  let groupsFound = 0;
  let shown = 0;

  for (const g of byTitle.values()) {
    if (g.length < 2) continue;

    // Cluster por preco: ordena e corta quando o gap passa de 20%.
    // Itens sem preco entram no maior cluster (titulo identico =
    // quase certamente o mesmo produto re-listado).
    const priced = g
      .filter((r) => r.price != null && r.price > 0)
      .sort((a, b) => a.price! - b.price!);
    const clusters: typeof g[] = [];
    for (const r of priced) {
      const last = clusters[clusters.length - 1];
      const lastPrice = last?.[last.length - 1]?.price;
      if (last && lastPrice != null && r.price! <= lastPrice * 1.2) {
        last.push(r);
      } else {
        clusters.push([r]);
      }
    }
    const noPrice = g.filter((r) => r.price == null || r.price <= 0);
    if (noPrice.length) {
      if (clusters.length === 0) clusters.push(noPrice);
      else {
        // anexa ao cluster com mais itens
        clusters.sort((a, b) => b.length - a.length);
        clusters[0].push(...noPrice);
      }
    }

    for (const c of clusters) {
      if (c.length < 2) continue;
      groupsFound++;
      c.sort((a, b) => {
        const score = (r: (typeof c)[number]) =>
          (r.imageUrl ? 4 : 0) +
          (r.affiliateUrl ? 2 : 0) +
          sourceScore(r.externalId);
        const d = score(b) - score(a);
        if (d !== 0) return d;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
      for (const r of c.slice(1)) toRemove.push(r.id);
      if (shown < 8) {
        shown++;
        console.log(
          `dup [${c.length}x] ${c.map((r) => r.externalId?.split(":")[0]).join("+")} | ${c[0].title?.slice(0, 70)}`,
        );
      }
    }
  }

  console.log(
    `${groupsFound} grupos duplicados cross-source, ${toRemove.length} linhas a remover.`,
  );
  if (toRemove.length === 0) return;

  const removed = await purgeProductsByIds(toRemove);
  const active = await prisma.product.count({ where: { active: true } });
  console.log(`Pronto. Removidos: ${removed}. Ativos agora: ${active}.`);
}

main().finally(() => prisma.$disconnect());
