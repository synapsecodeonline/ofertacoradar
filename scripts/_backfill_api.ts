// Backfill de categorias via Supabase Management API (query endpoint).
// Uso: SUPABASE_MGMT_TOKEN=sbp_... LOMADEE_API_KEY=... npx tsx scripts/_backfill_api.ts
// Usa o `segment` pré-definido das brands Lomadee como sinal de categoria.
import { resolveCategory, resolveSubtype } from "../src/lib/categories";

const REF = "xrytewzoxoynrwxffqft";
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
const LOMADEE_KEY = process.env.LOMADEE_API_KEY;
if (!TOKEN) {
  console.error("Defina SUPABASE_MGMT_TOKEN");
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;
const LOMADEE = process.env.LOMADEE_API_URL ?? "https://api.lomadee.com.br";

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

const esc = (s: string | null | undefined) =>
  s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`;

interface BrandInfo {
  name?: string;
  segment?: string;
}

// Busca todas as brands Lomadee (id -> {name, segment})
async function fetchBrands(): Promise<Map<string, BrandInfo>> {
  const map = new Map<string, BrandInfo>();
  if (!LOMADEE_KEY) return map;
  let page = 1;
  for (;;) {
    const res = await fetch(
      `${LOMADEE}/affiliate/brands?page=${page}&limit=20`,
      { headers: { "x-api-key": LOMADEE_KEY } },
    );
    if (!res.ok) break;
    const json = (await res.json()) as {
      data?: { id: string; name?: string; segment?: string }[];
      pagination?: { totalPages?: number };
      meta?: { totalPages?: number };
    };
    for (const b of json.data ?? []) {
      map.set(b.id, { name: b.name, segment: b.segment });
    }
    const tp = json.pagination?.totalPages ?? json.meta?.totalPages ?? page;
    if (page >= tp) break;
    page++;
    await new Promise((r) => setTimeout(r, 350));
  }
  return map;
}

async function main() {
  const brands = await fetchBrands();
  console.log(`${brands.size} brands Lomadee`);

  // Persiste segment/name das brands no banco
  const brandRows = [...brands.entries()];
  for (let i = 0; i < brandRows.length; i += 100) {
    const chunk = brandRows.slice(i, i + 100);
    const values = chunk
      .map(
        ([id, b]) =>
          `(${esc(id)},${esc(b.name ?? null)},${esc(b.segment ?? null)})`,
      )
      .join(",");
    await sql(
      `UPDATE "ofertacoradar"."Brand" b SET name = v.name, segment = v.segment
       FROM (VALUES ${values}) AS v(id, name, segment)
       WHERE b.id = v.id`,
    );
  }
  console.log("Brands atualizadas");

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
    subtype?: string | null;
  }[] = [];
  const PAGE = 1500;
  for (let off = 0; ; off += PAGE) {
    const rows = await sql(
      `SELECT id, title, category, subtype, merchant, "organizationId" FROM "ofertacoradar"."Product" ORDER BY id LIMIT ${PAGE} OFFSET ${off}`,
    );
    products.push(...rows);
    if (rows.length < PAGE) break;
  }
  console.log(`${products.length} produtos`);

  const updates: { id: number; category: string; subtype: string | null; merchant: string | null }[] = [];
  for (const p of products) {
    const brand = p.organizationId ? brands.get(p.organizationId) : undefined;
    const merchant =
      p.merchant ?? brand?.name ?? orgNames.get(p.organizationId ?? "") ?? null;
    const category =
      resolveCategory(p.category, p.title, merchant, brand?.segment) ?? "outros";
    const subtype = resolveSubtype(category, p.title);
    if (category !== p.category || subtype !== (p.subtype ?? null) || merchant !== p.merchant) {
      updates.push({ id: p.id, category, subtype, merchant });
    }
  }
  console.log(`${updates.length} produtos para atualizar`);

  const BATCH = 200;
  let done = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    const values = chunk
      .map((u) => `(${u.id},${esc(u.category)},${esc(u.subtype)},${esc(u.merchant)})`)
      .join(",");
    await sql(
      `UPDATE "ofertacoradar"."Product" p SET category = v.category, subtype = v.subtype, merchant = v.merchant
       FROM (VALUES ${values}) AS v(id, category, subtype, merchant)
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
