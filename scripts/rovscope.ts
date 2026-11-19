import { prisma } from "../src/lib/db";
import { getTrackedUrl } from "../src/lib/shortener";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function main() {
  const prods = await prisma.product.findMany({
    where: { active: true, externalId: { startsWith: "prod-lomadee:" }, organizationId: { not: null }, url: { contains: "rovitex.com.br" } },
    orderBy: { id: "desc" },
    take: 10,
    select: { id: true, title: true, url: true, organizationId: true },
  });
  for (const p of prods) {
    const tracked = await getTrackedUrl(p.url, p.organizationId!);
    if (!tracked) { console.log("sem lmdee |", p.title.slice(0, 45)); continue; }
    try {
      const res = await fetch(tracked, { redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
      const dead = res.status === 404;
      console.log(`${dead ? "404 " : "ok  "} | ${p.title.slice(0, 50)} | ${res.url.slice(-45)}`);
    } catch (e) { console.log("ERR |", p.title.slice(0,45), e instanceof Error ? e.message : e); }
    await new Promise(r => setTimeout(r, 500));
  }
  await prisma.$disconnect();
}
main();
