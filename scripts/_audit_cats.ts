// Auditoria de categoria/subcategoria: recomputa resolveCategory+resolveSubtype
// para todos os produtos e reporta divergencias + amostras para revisao.
// Uso: SUPABASE_MGMT_TOKEN=sbp_... npx tsx scripts/_audit_cats.ts
import { resolveCategory, resolveSubtype, CATEGORY_LABEL } from "../src/lib/categories";

const REF = "xrytewzoxoynrwxffqft";
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
if (!TOKEN) {
  console.error("SUPABASE_MGMT_TOKEN nao definido");
  process.exit(1);
}

async function sql(query: string): Promise<any[]> {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );
  if (!res.ok) throw new Error(`SQL ${res.status}: ${await res.text()}`);
  return res.json();
}

const esc = (s: string | null | undefined) =>
  s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`;

async function main() {
  const products: {
    id: number; title: string; category: string | null; subtype: string | null;
  }[] = [];
  const PAGE = 2000;
  for (let off = 0; ; off += PAGE) {
    const rows = await sql(
      `SELECT id, title, category, subtype FROM "ofertacoradar"."Product" ORDER BY id LIMIT ${PAGE} OFFSET ${off}`
    );
    products.push(...rows);
    if (rows.length < PAGE) break;
  }
  console.log(`${products.length} produtos\n`);

  // 1) Divergencias: valor gravado != valor recomputado pelo classificador atual
  const diffs: { id: number; title: string; cat: string; newCat: string; sub: string | null; newSub: string | null }[] = [];
  const nullSubByCat = new Map<string, number>();
  const totalByCat = new Map<string, number>();
  for (const p of products) {
    const cat = resolveCategory(p.category, p.title) ?? "outros";
    const sub = resolveSubtype(cat, p.title);
    totalByCat.set(cat, (totalByCat.get(cat) ?? 0) + 1);
    if (!sub) nullSubByCat.set(cat, (nullSubByCat.get(cat) ?? 0) + 1);
    if (cat !== (p.category ?? "outros") || sub !== (p.subtype ?? null)) {
      diffs.push({ id: p.id, title: p.title, cat: p.category ?? "-", newCat: cat, sub: p.subtype, newSub: sub });
    }
  }
  console.log(`Divergencias gravado vs recomputado: ${diffs.length}`);
  for (const d of diffs.slice(0, 30)) {
    console.log(`  #${d.id} [${d.cat}->${d.newCat}] sub:${d.sub}->${d.newSub} | ${d.title.slice(0, 70)}`);
  }

  // 2) Subtipo nulo por categoria (itens que caem so em "Todos")
  console.log("\n=== Itens SEM subtipo por categoria (top 25) ===");
  const nullRows = [...nullSubByCat.entries()]
    .map(([c, n]) => ({ c, n, total: totalByCat.get(c) ?? 0 }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 25);
  for (const r of nullRows) {
    console.log(`  ${r.c} (${CATEGORY_LABEL[r.c] ?? r.c}): ${r.n}/${r.total} sem subtipo`);
  }

  // 3) Amostras: 4 titulos aleatorios por categoria com subtipo (revisao manual)
  console.log("\n=== Amostras por categoria/subtipo ===");
  const byKey = new Map<string, string[]>();
  for (const p of products) {
    const cat = resolveCategory(p.category, p.title) ?? "outros";
    const sub = resolveSubtype(cat, p.title);
    if (!sub) continue;
    const k = `${cat}/${sub}`;
    const arr = byKey.get(k) ?? [];
    if (arr.length < 4) arr.push(p.title);
    byKey.set(k, arr);
  }
  const cats = [...new Set(products.map((p) => resolveCategory(p.category, p.title) ?? "outros"))]
    .sort((a, b) => (totalByCat.get(b) ?? 0) - (totalByCat.get(a) ?? 0))
    .slice(0, 20);
  for (const cat of cats) {
    console.log(`\n## ${cat} (${CATEGORY_LABEL[cat] ?? cat}) — ${totalByCat.get(cat)} itens`);
    for (const [k, titles] of byKey) {
      if (!k.startsWith(cat + "/")) continue;
      const sub = k.split("/")[1];
      console.log(`  - ${sub}:`);
      for (const t of titles) console.log(`      ${t.slice(0, 80)}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
