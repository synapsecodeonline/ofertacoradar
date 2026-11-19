import { prisma } from "../src/lib/db";
async function main() {
  const n = await prisma.product.count();
  console.log("produtos:", n);
  await prisma.$disconnect();
}
main().catch(e => { console.log("ERRO:", e.message?.slice(0, 200)); process.exit(1); });
