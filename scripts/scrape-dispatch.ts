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
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { readFileSync, existsSync } from "fs";

const exec = promisify(execFile);
const ROOT = join(__dirname, "..");
const STALE_MS = 45 * 60_000;

// Erro de cancelamento pedido pelo admin (botao "Parar" grava
// scrape-cancel:{src}; o run() vigia a flag e mata o processo).
class Cancelled extends Error {
  out = "";
}

const dockerUp = async () => {
  try {
    await exec("docker", ["info"], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
};

// Mata containers `compose run` do projeto — derrubar o client
// `docker compose run` NAO para o container; sem isso o scrape
// continuaria rodando depois do "Parar".
async function killProjectContainers(project: string) {
  try {
    const { stdout } = await exec(
      "docker",
      ["ps", "-q", "--filter", `label=com.docker.compose.project=${project}`],
      { timeout: 10_000 },
    );
    for (const id of stdout.split("\n").map((s) => s.trim()).filter(Boolean)) {
      await exec("docker", ["rm", "-f", id], { timeout: 15_000 }).catch(() => {});
    }
  } catch {
    /* docker indisponivel — o kill do processo ja ajuda */
  }
}

// Executa via spawn (process group) e devolve o output combinado
// mesmo em erro — o tail vira o "log" que aparece na tela do admin.
// onCancel: checado a cada 4s; se true, mata o grupo de processos
// (e os containers docker do projeto) e rejeita com Cancelled.
async function run(
  cmd: string,
  args: string[],
  opts?: { onCancel?: () => Promise<boolean>; project?: string },
): Promise<string> {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, detached: true });
    let out = "";
    const push = (d: Buffer) => {
      const s = d.toString();
      out += s;
      if (out.length > 8 * 1024 * 1024) out = out.slice(-4 * 1024 * 1024);
      // ecoa ao vivo — o cron loga a saida completa
      process.stdout.write(s);
    };
    child.stdout?.on("data", push);
    child.stderr?.on("data", push);

    let done = false;
    let cancelled = false;
    let timedOut = false;
    const killTree = () => {
      try {
        process.kill(-(child.pid as number), "SIGKILL");
      } catch {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ja morreu */
        }
      }
    };
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearInterval(killer);
      clearTimeout(timer);
      fn();
    };
    let killer: ReturnType<typeof setInterval> | undefined;
    if (opts?.onCancel) {
      killer = setInterval(() => {
        void opts
          .onCancel!()
          .then((yes) => {
            if (yes && !done) {
              cancelled = true;
              killTree();
              if (opts.project) void killProjectContainers(opts.project);
            }
          })
          .catch(() => {});
      }, 4_000);
    }
    const timer = setTimeout(() => {
      if (done) return;
      timedOut = true;
      killTree();
    }, 45 * 60_000);

    child.on("error", (e) =>
      finish(() => {
        const err = e as Error & { out?: string };
        err.out = out.slice(-4000);
        reject(err);
      }),
    );
    child.on("close", (code) =>
      finish(() => {
        if (cancelled) {
          const err = new Cancelled("cancelado pelo usuário") as Cancelled;
          err.out = out.slice(-4000);
          reject(err);
        } else if (timedOut) {
          const err = new Error("timeout 45min") as Error & { out: string };
          err.out = out.slice(-4000);
          reject(err);
        } else if (code === 0) {
          resolve(out);
        } else {
          const err = new Error(`exit ${code}`) as Error & { out: string };
          err.out = out.slice(-4000);
          reject(err);
        }
      }),
    );
  });
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
  try {
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
  } catch {
    return; // pedido foi cancelado (deletado) entre a leitura e o update
  }

  // Flag de cancelamento do admin: scrape-cancel:{src} com `at`
  // posterior a runningAt = pedido de parada DESTA execucao (flags
  // antigas sao de runs passadas e nao valem).
  const cancelKey = `scrape-cancel:${src}`;
  const isCancelled = async () => {
    const c = await prisma.scriptState
      .findUnique({ where: { key: cancelKey } })
      .catch(() => null);
    const at =
      c?.value && typeof c.value === "object"
        ? new Date((c.value as { at?: string }).at ?? 0).getTime()
        : 0;
    return at >= new Date(runningAt).getTime();
  };

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
  const runOpts = {
    onCancel: isCancelled,
    project: src === "ml" ? "ml" : "amz",
  };
  let out = "";
  try {
    // cancelamento pode ter chegado entre o "running" e o spawn
    if (await isCancelled()) throw new Cancelled("cancelado pelo usuário");
    if (src === "ml") {
      if (useDocker) {
        // compose run substitui o command inteiro — precisa repetir
        // o entrypoint (run-scrape.sh) antes dos args do admin
        out = await run("docker", [
          "compose", "-f", "deploy/ml/docker-compose.yml",
          "--profile", "scrape", "run", "--rm", "scrape",
          "bash", "deploy/ml/run-scrape.sh", ...extraArgs,
        ], runOpts);
      } else {
        out = await run("npx", [
          "tsx", "--env-file=.env", "scripts/ml-scrape.ts",
          ...extraArgs, "--max-new", "60",
        ], runOpts);
      }
    } else {
      if (useDocker) {
        out = await run("docker", [
          "compose", "-f", "deploy/amazon/docker-compose.yml",
          "--profile", "scrape", "run", "--rm", "scrape",
          "bash", "deploy/amazon/run-scrape.sh", ...extraArgs,
        ], runOpts);
      } else {
        out = await run("npx", [
          "tsx", "--env-file=.env", "scripts/amz-scrape.ts",
          ...extraArgs, "--max-new", "5",
        ], runOpts);
        if (!(await isCancelled())) {
          out += await run("npx", ["tsx", "--env-file=.env", "scripts/amz-verify.ts"], runOpts);
        }
      }
    }
  } catch (e) {
    out = (e as { out?: string }).out ?? String(e);
    if (e instanceof Cancelled) {
      console.log(`[dispatch:${src}] cancelado pelo admin`);
      await reportScrape(src, false, { erro: "cancelado pelo usuário" });
    } else {
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
    }
  } finally {
    // log sempre — sucesso ou erro — para diagnostico na tela
    await reportScrapeLog(src, hostLogTail(src, out, useDocker));
    // limpa o pedido e a flag de cancel — o resultado fica em scrape:{src}
    await prisma.scriptState.delete({ where: { key } }).catch(() => {});
    await prisma.scriptState.delete({ where: { key: cancelKey } }).catch(() => {});
  }
}

async function main() {
  const rows = await prisma.scriptState.findMany({
    where: { key: { startsWith: "scrape-request:" } },
  });
  for (const r of rows) {
    const src = r.key.split(":")[1];
    if (src !== "ml" && src !== "amz") continue;
    // um src falhar nao pode impedir o outro de rodar
    await dispatch(src as ScrapeSrc).catch((e) =>
      console.error(`[dispatch:${src}] erro fatal:`, e),
    );
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
