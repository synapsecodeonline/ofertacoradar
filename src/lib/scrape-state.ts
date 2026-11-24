import { prisma } from "./db";

// Estado dos scrapers locais (Amazon/ML) em ScriptState — o site roda
// em container e nao ve os logs do host; o banco e o canal.
//   scrape:{src}          -> { at, ok, ...stats } resultado da ultima run
//   scrape-request:{src}  -> { at, status } pedido do botao no admin
//     status: "queued" (admin pediu) | "running" (dispatch pegou)
export type ScrapeSrc = "ml" | "amz";

export async function reportScrape(
  src: ScrapeSrc,
  ok: boolean,
  stats?: Record<string, unknown>,
) {
  try {
    await prisma.scriptState.upsert({
      where: { key: `scrape:${src}` },
      create: {
        key: `scrape:${src}`,
        value: { at: new Date().toISOString(), ok, ...stats },
      },
      update: {
        value: { at: new Date().toISOString(), ok, ...stats },
      },
    });
  } catch (e) {
    console.error(`[scrape-state] falha ao gravar scrape:${src}:`, e);
  }
}
