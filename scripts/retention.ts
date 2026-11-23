// Retencao de dados — evita que as tabelas de analytics/historico
// estourem o disco do Supabase free tier (500MB).
//
// Politica:
//   PriceHistory > 180d  → apaga, EXCETO linhas com o menor preco
//                          historico do produto (pagina usa so _min)
//   Event       > 90d    → apaga (analytics so precisa do recente)
//   Click       > 180d   → apaga (prova social conta total, nao periodo)
//   endsAt vencido      → produto removido (cupom/oferta expirada = obsoleto;
//                          se a fonte reenviar com nova data, volta pelo upsert)
//
// Roda no workflow semanal (recategorize.yml) e manual:
//   npm run retention
import { prisma } from "../src/lib/db";
import { purgeProducts } from "../src/lib/product-purge";

const PRICE_HISTORY_DAYS = 180;
const EVENT_DAYS = 90;
const CLICK_DAYS = 180;

async function main() {
  const ph = await prisma.$executeRaw`
    DELETE FROM "ofertacoradar"."PriceHistory" h
    WHERE h."recordedAt" < now() - (${PRICE_HISTORY_DAYS} || ' days')::interval
      AND h.price > (
        SELECT min(p2.price) FROM "ofertacoradar"."PriceHistory" p2
        WHERE p2."productId" = h."productId"
      )
  `;
  const ev = await prisma.event.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - EVENT_DAYS * 864e5) } },
  });
  const cl = await prisma.click.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - CLICK_DAYS * 864e5) } },
  });
  const exp = await purgeProducts({ endsAt: { lt: new Date() } });
  console.log(
    `retencao: PriceHistory -${ph} | Event -${ev.count} | Click -${cl.count} | expirados -${exp}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
