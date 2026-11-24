// Dispatcher local dos scrapers (roda no host via cron 1min):
// le pedidos "scrape-request:{src}" gravados pelo botao no admin,
// marca "running" e executa o scrape correspondente (Docker ou
// fallback local). O resultado final e gravado pelo proprio scrape
// em "scrape:{src}" via reportScrape(); se a execucao falhar antes
// do scraper reportar (docker off, entrypoint errado, timeout), o
// dispatcher mesmo grava scrape:{src} ok:false + o tail do log em
// "scrape-log:{src}" — o admin mostra tudo em /admin/servicos.
//
// Um pedido "running" ha menos de 45min e considerado vivo — se o
// dispatcher morrer no meio, o proximo ciclo o retoma.
import { prisma } from "../src/lib/db";
import { reportScrape, reportScrapeLog, type ScrapeSrc } from "../src/lib/scrape-state";
import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { readFileSync, existsSync } from "fs";

const exec = promisify(execFile);
const ROOT = join(__dirname, "..");
const STALE_MS = 45 * 60_000;

const dockerUp = async () => {
  try {
    await exec("docker", ["info"], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
};

// Executa e devolve o output combinado (stdout+stderr) mesmo em
// erro — o tail vira o "log" que aparece na tela do admin.
async function run(cmd: string, args: string[]): Promise<string> {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  try {
    const { stdout, stderr } = await exec(cmd, args, {
      cwd: ROOT,
      timeout: 45 * 60_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    const out = `${stdout}\n${stderr}`;
    if (stdout.trim()) console.log(stdout.slice(-2000));
    if (stderr.trim()) console.error(stderr.slice(-2000));
    return out;
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const out = `${err.stdout ?? ""}\n${err.stderr ?? ""}\n${err.message ?? e}`;
    console.error(out.slice(-2000));
    const wrapped = new Error(out.slice(-4000)) as Error & { out: string };
    wrapped.out = out.slice(-4000);
    throw wrapped;
  }
}

// O scrape docker escreve em logs/{ml,amz}-scrape.log — esse arquivo
// tem a saida COMPLETA (o stdout do docker run e quase vazio).
// SO le o arquivo quando a execucao foi docker: no fallback local o
// script nao escreve no log e o tail seria de uma execucao ANTIGA
// (engana o admin). Sem docker, usa o output capturado.
function hostLogTail(src: ScrapeSrc, fallback: string, useDocker: boolean): string {
  if (!useDocker) return fallback.slice(-4000);
  const file = join(ROOT, "logs", src === "ml" ? "ml-scrape.log" : "amz-scrape.log");
  try {
    if (existsSync(file)) {
      const content = readFileSync(file, "utf8");
      // so o trecho desta execucao: depois do ultimo "=====" 
      const idx = content.lastIndexOf("=====");
      const tail = idx >= 0 ? content.slice(idx) : content;
      if (tail.trim()) return tail.slice(-4000);
    }
  } catch {
    /* sem arquivo — usa fallback */
  }
  return fallback.slice(-4000);
}

async function dispatch(src: ScrapeSrc) {
  const key = `scrape-request:${src}`;
  const req = await prisma.scriptState.findUnique({ where: { key } });
  const st = req?.value as
    | { status?: string; at?: string; queries?: string[]; maxNew?: number }
    | undefined;
  if (!st || (st.status !== "queued" && st.status !== "running")) return;

  const age = st.at ? Date.now() - new Date(st.at).getTime() : Infinity;
  if (st.status === "running" && age < STALE_MS) return; // ja em execucao

  const runningAt = new Date().toISOString();
  await prisma.scriptState.update({
    where: { key },
    data: {
      value: {
        at: runningAt,
        status: "running",
        queries: st.queries,
        maxNew: st.maxNew,
      },
    },
  });

  // palavras-chave vindas do admin viram --queries "a,b,c" e
  // maxNew vira --max-new N (o arg() dos scrapers pega a 1a ocorrencia)
  const extraArgs = [
    ...(Array.isArray(st.queries) && st.queries.length
      ? ["--queries", st.queries.join(",")]
      : []),
    ...(typeof st.maxNew === "number" && st.maxNew >= 1
      ? ["--max-new", String(Math.floor(st.maxNew))]
      : []),
  ];

  const useDocker = await dockerUp();
  let out = "";
  try {
    if (src === "ml") {
      if (useDocker) {
        // compose run substitui o command inteiro — precisa repetir
        // o entrypoint (run-scrape.sh) antes dos args do admin
        out = await run("docker", [
          "compose", "-f", "deploy/ml/docker-compose.yml",
          "--profile", "scrape", "run", "--rm", "scrape",
          "bash", "deploy/ml/run-scrape.sh", ...extraArgs,
        ]);
      } else {
        out = await run("npx", [
          "tsx", "--env-file=.env", "scripts/ml-scrape.ts",
          ...extraArgs, "--max-new", "60",
        ]);
      }
    } else {
      if (useDocker) {
        out = await run("docker", [
          "compose", "-f", "deploy/amazon/docker-compose.yml",
          "--profile", "scrape", "run", "--rm", "scrape",
          "bash", "deploy/amazon/run-scrape.sh", ...extraArgs,
        ]);
      } else {
        out = await run("npx", [
          "tsx", "--env-file=.env", "scripts/amz-scrape.ts",
          ...extraArgs, "--max-new", "5",
        ]);
        out += await run("npx", ["tsx", "--env-file=.env", "scripts/amz-verify.ts"]);
      }
    }
  } catch (e) {
    out = (e as { out?: string }).out ?? String(e);
    console.error(`[dispatch:${src}] scrape falhou:`, out.slice(0, 500));
    // so reporta se o scraper NAO reportou sozinho — o catch dele ja
    // grava scrape:{src} ok:false com o erro real; sobrescrever com
    // o erro do docker (que e so "container failed") esconderia a
    // causa verdadeira
    const prev = await prisma.scriptState
      .findUnique({ where: { key: `scrape:${src}` } })
      .catch(() => null);
    const prevAt = prev?.value && typeof prev.value === "object"
      ? new Date((prev.value as { at?: string }).at ?? 0).getTime()
      : 0;
    if (prevAt < new Date(runningAt).getTime() - 5_000) {
      await reportScrape(src, false, {
        erro: out.split("\n").filter((l) => l.trim()).slice(-3).join(" | ").slice(0, 300),
      });
    }
  } finally {
    // log sempre — sucesso ou erro — para diagnostico na tela
    await reportScrapeLog(src, hostLogTail(src, out, useDocker));
    // limpa o pedido — o resultado fica em scrape:{src}
    await prisma.scriptState.delete({ where: { key } }).catch(() => {});
  }
}

async function main() {
  const rows = await prisma.scriptState.findMany({
    where: { key: { startsWith: "scrape-request:" } },
  });
  for (const r of rows) {
    const src = r.key.split(":")[1];
    if (src === "ml" || src === "amz") await dispatch(src as ScrapeSrc);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
