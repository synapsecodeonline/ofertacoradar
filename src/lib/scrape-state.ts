import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

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

// Mescla campos em scrape:{src} sem perder o reporte do scraper —
// o dispatcher usa depois do verify para corrigir `ativos` (o verify
// pode ter removido produtos "sem desconto" depois do scrape contar)
// e gravar `cadastrados` (titulos criados naquela execucao).
export async function amendScrape(
  src: ScrapeSrc,
  patch: Record<string, unknown>,
) {
  try {
    const key = `scrape:${src}`;
    const cur = await prisma.scriptState.findUnique({ where: { key } });
    const v = (cur?.value ?? {}) as Record<string, unknown>;
    const merged = {
      at: new Date().toISOString(),
      ok: true,
      ...v,
      ...patch,
    } as Prisma.InputJsonValue;
    await prisma.scriptState.upsert({
      where: { key },
      create: { key, value: merged },
      update: { value: merged },
    });
  } catch (e) {
    console.error(`[scrape-state] falha ao emendar scrape:${src}:`, e);
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
