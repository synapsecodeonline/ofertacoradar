// Auditoria profunda: (a) amostras de titulos SEM subtipo nas categorias
// com mais lacuna; (b) produtos cuja categoria atribuida diverge do que o
// titulo indica (matchAllCategories). Uso: SUPABASE_MGMT_TOKEN=sbp_... npx tsx scripts/_audit_deep.ts
import { resolveCategory, resolveSubtype, matchAllCategories, merchantCategory, CATEGORY_LABEL } from "../src/lib/categories";

const REF = "xrytewzoxoynrwxffqft";
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
if (!TOKEN) { console.error("SUPABASE_MGMT_TOKEN nao definido"); process.exit(1); }

async function sql(query: string): Promise<any[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL ${res.status}: ${await res.text()}`);
  return res.json();
}

const TOP_GAP = ["ferramentas","calcados","esporte-lazer","perfumaria","saude","alimentos-bebidas","eletrodomesticos","papelaria","moda-feminina","cozinha","pecas-veiculos","construcao","outros"];

async function main() {
  const products: any[] = [];
  for (let off = 0; ; off += 2000) {
    const rows = await sql(`SELECT id, title, category, subtype, merchant, "organizationId" FROM "ofertacoradar"."Product" ORDER BY id LIMIT 2000 OFFSET ${off}`);
    products.push(...rows);
    if (rows.length < 2000) break;
  }
  const orgs = await sql(`SELECT "organizationId", name FROM "ofertacoradar"."AffiliatedOrg" WHERE name IS NOT NULL`) as any[];
  const orgNames = new Map(orgs.map((o) => [o.organizationId, o.name]));
  const merchantOf = (p: any) => p.merchant ?? (p.organizationId ? orgNames.get(p.organizationId) : null) ?? null;

  // (a) titulos sem subtipo nas categorias alvo
  console.log("=== TITULOS SEM SUBTIPO (amostras) ===");
  for (const cat of TOP_GAP) {
    const titles = products
      .filter((p) => (p.category ?? "outros") === cat && !resolveSubtype(cat, p.title))
      .map((p) => p.title);
    if (!titles.length) continue;
    console.log(`\n## ${cat} (${CATEGORY_LABEL[cat] ?? cat}) — ${titles.length} sem subtipo`);
    // agrupa por "primeira palavra relevante" para ver padroes
    const freq = new Map<string, number>();
    for (const t of titles) {
      const w = t.toLowerCase().replace(/[^a-zà-ú0-9 ]/g, " ").split(/\s+/).filter((x: string) => x.length > 3)[0] ?? "?";
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w, n]) => `${w}:${n}`).join(" ");
    console.log(`  freq: ${top}`);
    for (const t of titles.slice(0, 10)) console.log(`   - ${t.slice(0, 85)}`);
  }

  // (b) divergencia titulo vs categoria: titulo casa com OUTRA categoria
  // e a categoria atual NAO esta entre os matches do titulo
  console.log("\n=== SUSPEITOS: titulo indica outra categoria ===");
  const sus: Record<string, { cur: string; sug: string; title: string; merchant: string | null }[]> = {};
  for (const p of products) {
    const cur = p.category ?? "outros";
    const m = merchantOf(p);
    const mc = merchantCategory(m);
    // se merchant mapeado, a vertical da loja vence — nao e suspeito
    if (mc && mc === cur) continue;
    const matches = matchAllCategories(p.title);
    if (!matches.length) continue;
    if (matches.includes(cur)) continue;
    // titulo aponta fortemente para outra categoria
    const sug = matches[0];
    if (sug === cur) continue;
    (sus[`${cur} -> ${sug}`] ??= []).push({ cur, sug, title: p.title, merchant: m });
  }
  const entries = Object.entries(sus).sort((a, b) => b[1].length - a[1].length).slice(0, 15);
  for (const [k, list] of entries) {
    console.log(`\n## ${k} (${list.length})`);
    for (const s of list.slice(0, 8)) console.log(`   - [${s.merchant ?? "-"}] ${s.title.slice(0, 80)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
