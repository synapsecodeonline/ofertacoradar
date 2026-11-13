// Backfill de categorias via Supabase Management API (query endpoint).
// Uso: SUPABASE_MGMT_TOKEN=sbp_... npx tsx scripts/_backfill_api.ts
// Alternativa ao _backfill.ts quando a conexao direta ao pooler falha.
import { resolveCategory } from "../src/lib/categories";

const REF = "xrytewzoxoynrwxffqft";
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
if (!TOKEN) {
  console.error("Defina SUPABASE_MGMT_TOKEN");
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function sql<T = any>(query: string): Promise<T[]> {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(`SQL ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

const esc = (s: string | null) => (s == null ? "NULL" : `'${s.replace(/'/g, "''")}'`);

async function main() {
  const orgs = await sql<{ organizationId: string; name: string | null }>(
    `SELECT "organizationId", name FROM "ofertacoradar"."AffiliatedOrg" WHERE name IS NOT NULL`,
  );
  const orgNames = new Map(orgs.map((o) => [o.organizationId, o.name!]));
  console.log(`${orgs.length} orgs`);

  // Pagina produtos (endpoint pode ter limite de payload)
  const products: {
    id: number;
    title: string;
    category: string | null;
    merchant: string | null;
    organizationId: string | null;
  }[] = [];
  const PAGE = 1500;
  for (let off = 0; ; off += PAGE) {
    const rows = await sql(
      `SELECT id, title, category, merchant, "organizationId" FROM "ofertacoradar"."Product" ORDER BY id LIMIT ${PAGE} OFFSET ${off}`,
    );
    products.push(...rows);
    if (rows.length < PAGE) break;
  }
  console.log(`${products.length} produtos`);

  const updates: { id: number; category: string; merchant: string | null }[] = [];
  for (const p of products) {
    const category = resolveCategory(p.category, p.title) ?? "outros";
    const merchant =
      p.merchant ?? (p.organizationId ? orgNames.get(p.organizationId) : undefined) ?? null;
    if (category !== p.category || merchant !== p.merchant) {
      updates.push({ id: p.id, category, merchant });
    }
  }
  console.log(`${updates.length} produtos para atualizar`);

  const BATCH = 200;
  let done = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    const values = chunk
      .map((u) => `(${u.id},${esc(u.category)},${esc(u.merchant)})`)
      .join(",");
    await sql(
      `UPDATE "ofertacoradar"."Product" p SET category = v.category, merchant = v.merchant
       FROM (VALUES ${values}) AS v(id, category, merchant)
       WHERE p.id = v.id`,
    );
    done += chunk.length;
    if (done % 1000 < BATCH) console.log(`${done}/${updates.length}`);
  }

  const dist = await sql<{ category: string | null; n: number }>(
    `SELECT category, count(*)::int AS n FROM "ofertacoradar"."Product" GROUP BY category ORDER BY n DESC LIMIT 15`,
  );
  console.log("Top categorias:", dist.map((d) => `${d.category}:${d.n}`).join(" "));
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
