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

// Pooler do Supabase da statement_timeout transitorio quando o sync
// compete — mesmo padrao do withRetry do daily-kit/amz-scrape.
async function withRetry<T>(
  fn: () => Promise<T>,
  tries = 4,
  waitMs = 8_000,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      console.log(
        `Query falhou (tentativa ${i + 1}/${tries}):`,
        String(e).slice(0, 140),
      );
      if (i < tries - 1) {
        await new Promise((r) => setTimeout(r, waitMs * (i + 1)));
      }
    }
  }
  throw last;
}

async function main() {
  const rows = await withRetry(() =>
    prisma.product.findMany({
    where: { active: true },
    select: {
      id: true,
      title: true,
      description: true,
      merchant: true,
      category: true,
      externalId: true,
    },
    }),
  );
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
  // Updates em lotes de 20 com retry por lote — sequencial puro
  // estourava o tempo do job no GitHub Actions (~10k produtos).
  const CHUNK = 20;
  let done = 0;
  let failed = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const results = await withRetry(() =>
      Promise.allSettled(
        chunk.map((u) =>
          prisma.product.update({
            where: { id: u.id },
            data: {
              ...(u.title !== undefined ? { title: u.title } : {}),
              ...(u.cat !== null
                ? { category: u.cat, subtype: u.sub }
                : {}),
            },
          }),
        ),
      ),
    ).catch(() => null);
    if (!results) {
      failed += chunk.length;
      continue;
    }
    for (const r of results) {
      if (r.status === "fulfilled") done++;
      else failed++;
    }
    if ((i / CHUNK) % 25 === 0) {
      console.log(`  ${done}/${updates.length} atualizados...`);
    }
  }
  console.log(
    `\n${done} produtos atualizados${failed ? `, ${failed} falhas` : ""}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
