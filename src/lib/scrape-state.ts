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

// Tail do log da execucao — o site nao ve logs/ml-scrape.log do host,
// entao o dispatcher empurra o final do arquivo para ca. O admin
// mostra em /admin/servicos quando o scrape falha (ou sempre, em
// <details>).
export async function reportScrapeLog(src: ScrapeSrc, tail: string) {
  try {
    await prisma.scriptState.upsert({
      where: { key: `scrape-log:${src}` },
      create: {
        key: `scrape-log:${src}`,
        value: { at: new Date().toISOString(), tail: tail.slice(-4000) },
      },
      update: {
        value: { at: new Date().toISOString(), tail: tail.slice(-4000) },
      },
    });
  } catch (e) {
    console.error(`[scrape-state] falha ao gravar scrape-log:${src}:`, e);
  }
}
