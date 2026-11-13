// Lista produtos de uma categoria. Uso: SUPABASE_MGMT_TOKEN=sbp_... npx tsx scripts/_list_cat.ts software
const REF = "xrytewzoxoynrwxffqft";
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
if (!TOKEN) { console.error("SUPABASE_MGMT_TOKEN"); process.exit(1); }

async function sql(query: string): Promise<any[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const cat = process.argv[2];
  if (!cat) { console.error("uso: _list_cat.ts <categoria>"); process.exit(1); }
  const rows = await sql(
    `SELECT title, subtype, merchant, "organizationId" FROM "ofertacoradar"."Product" WHERE category='${cat.replace(/'/g, "''")}' ORDER BY id`,
  );
  console.log(`${rows.length} produtos em ${cat}`);
  for (const p of rows) console.log(`- ${String(p.title).slice(0, 95)} | ${p.merchant ?? "-"} | ${p.subtype ?? "-"}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
