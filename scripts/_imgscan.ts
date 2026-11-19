import { prisma } from "../src/lib/db";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

async function check(u: string): Promise<"ok" | "dead" | "amb" | "small"> {
  const url = u.trim().replace(/ /g, "%20");
  for (let a = 0; a < 2; a++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { "user-agent": UA }, redirect: "follow" });
      if (r.status === 404 || r.status === 410 || r.status === 400) {
        if (a === 0) { await new Promise((s) => setTimeout(s, 800)); continue; }
        return "dead";
      }
      if (!r.ok) return "amb";
      const ct = r.headers.get("content-type") ?? "";
      if (/text\/html/.test(ct)) {
        if (a === 0) { await new Promise((s) => setTimeout(s, 800)); continue; }
        return "dead";
      }
      const len = Number(r.headers.get("content-length") ?? 0);
      if (len > 0 && len < 500) return "small";
      return "ok";
    } catch { return "amb"; }
  }
  return "amb";
}

async function main() {
  const products = await prisma.product.findMany({
    where: { active: true, imageUrl: { not: null } },
    select: { id: true, imageUrl: true, title: true, merchant: true },
  });
  console.log("produtos ativos com imagem:", products.length);
  const dead: typeof products = [];
  let ok = 0, amb = 0, small = 0, done = 0;
  const CONC = 12;
  for (let i = 0; i < products.length; i += CONC) {
    const chunk = products.slice(i, i + CONC);
    const res = await Promise.all(chunk.map(async (p) => ({ p, s: await check(p.imageUrl!) })));
    for (const { p, s } of res) {
      done++;
      if (s === "dead") dead.push(p);
      else if (s === "ok") ok++;
      else if (s === "small") { small++; dead.push(p); }
      else amb++;
    }
    if (done % 600 < CONC) console.log(`progresso ${done}/${products.length} ok=${ok} mortas=${dead.length} inconc=${amb}`);
  }
  console.log(`\nFIM ok=${ok} mortas=${dead.length} inconc=${amb}`);
  const byHost = new Map<string, number>();
  for (const p of dead) {
    try { const h = new URL(p.imageUrl!).hostname; byHost.set(h, (byHost.get(h) ?? 0) + 1); } catch {}
  }
  console.log("mortas por host:", [...byHost.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15));
  // desativa as mortas
  if (dead.length) {
    const r = await prisma.product.updateMany({ where: { id: { in: dead.map((p) => p.id) } }, data: { active: false } });
    console.log("desativados:", r.count);
  }
  await prisma.$disconnect();
}
main();
