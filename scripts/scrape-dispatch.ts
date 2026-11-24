// Dispatcher local dos scrapers (roda no host via cron 1min):
// le pedidos "scrape-request:{src}" gravados pelo botao no admin,
// marca "running" e executa o scrape correspondente (Docker ou
// fallback local). O resultado final e gravado pelo proprio scrape
// em "scrape:{src}" via reportScrape().
//
// Um pedido "running" ha menos de 45min e considerado vivo — se o
// dispatcher morrer no meio, o proximo ciclo o retoma.
import { prisma } from "../src/lib/db";
import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";

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

async function run(cmd: string, args: string[]) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const { stdout, stderr } = await exec(cmd, args, {
    cwd: ROOT,
    timeout: 45 * 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (stdout.trim()) console.log(stdout.slice(-2000));
  if (stderr.trim()) console.error(stderr.slice(-2000));
}

async function dispatch(src: "ml" | "amz") {
  const key = `scrape-request:${src}`;
  const req = await prisma.scriptState.findUnique({ where: { key } });
  const st = req?.value as
    | { status?: string; at?: string; queries?: string[]; maxNew?: number }
    | undefined;
  if (!st || (st.status !== "queued" && st.status !== "running")) return;

  const age = st.at ? Date.now() - new Date(st.at).getTime() : Infinity;
  if (st.status === "running" && age < STALE_MS) return; // ja em execucao

  await prisma.scriptState.update({
    where: { key },
    data: {
      value: {
        at: new Date().toISOString(),
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
  try {
    if (src === "ml") {
      if (useDocker) {
        await run("docker", [
          "compose", "-f", "deploy/ml/docker-compose.yml",
          "--profile", "scrape", "run", "--rm", "scrape",
          ...extraArgs,
        ]);
      } else {
        await run("npx", [
          "tsx", "--env-file=.env", "scripts/ml-scrape.ts",
          ...extraArgs, "--max-new", "60",
        ]);
      }
    } else {
      if (useDocker) {
        await run("docker", [
          "compose", "-f", "deploy/amazon/docker-compose.yml",
          "--profile", "scrape", "run", "--rm", "scrape",
          ...extraArgs,
        ]);
      } else {
        await run("npx", [
          "tsx", "--env-file=.env", "scripts/amz-scrape.ts",
          ...extraArgs, "--max-new", "5",
        ]);
        await run("npx", ["tsx", "--env-file=.env", "scripts/amz-verify.ts"]);
      }
    }
  } catch (e) {
    console.error(`[dispatch:${src}] scrape falhou:`, e);
  } finally {
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
    if (src === "ml" || src === "amz") await dispatch(src);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
