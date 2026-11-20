// Verifica elegibilidade de afiliado dos produtos amz: via sessao logada
// da Amazon (SiteStripe). Para cada ASIN nao verificado, abre a pagina do
// produto e observa a chamada /associate que a propria SiteStripe faz:
//   - shareEligibility.eligible presente OU botao "Obter link" -> elegivel
//   - API respondeu SEM eligible E sem botao de link            -> inelegivel
//     (produto e desativado)
//   - nenhum sinal (sessao expirada/captcha/pagina quebrada)    -> pula,
//     NAO desativa (conservador: so remove com prova negativa)
//
// Requer sessao valida: rode antes `npx tsx scripts/amz-login.ts`
// (salva em ~/.config/ofertacoradar/amz-state.json — fora do repo).
//
// Uso: npx tsx scripts/amz-verify.ts [--all] [--limit N]
//   --all    re-verifica tudo, ignorando o conjunto ja verificado
//   --limit N  maximo de produtos nesta execucao
import { chromium, type Response } from "playwright";
import { prisma } from "../src/lib/db";
import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

const STATE = join(homedir(), ".config", "ofertacoradar", "amz-state.json");
const VERIFIED_FILE = join(
  homedir(),
  ".config",
  "ofertacoradar",
  "amz-verified.json",
);
const LIBS = join(
  homedir(),
  ".local/share/ofertacoradar-chromelibs/x86_64-linux-gnu",
);
process.env.LD_LIBRARY_PATH = `${LIBS}:${process.env.LD_LIBRARY_PATH ?? ""}`;

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const ALL = process.argv.includes("--all");
const LIMIT = Number(arg("limit") ?? Infinity);
const DELAY = Number(arg("delay") ?? 3000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Verdict = "eligible" | "ineligible" | "unknown";

async function checkAsin(
  page: import("playwright").Page,
  asin: string,
): Promise<Verdict> {
  let apiBody = "";
  let apiSeen = false;
  const onResp = (res: Response) => {
    if (res.url().includes(`/products/${asin}/associate`)) {
      apiSeen = true;
      res.text().then((t) => (apiBody = t)).catch(() => {});
    }
  };
  page.on("response", onResp);
  try {
    await page.goto(`https://www.amazon.com.br/dp/${asin}`, {
      waitUntil: "load",
      timeout: 45000,
    });
    // espera a SiteStripe disparar a chamada /associate
    for (let i = 0; i < 20 && !apiBody; i++) await sleep(500);
    await sleep(1500);
    const dom = await page.evaluate(() => ({
      getLink: !!document.getElementById("amzn-ss-get-link-button"),
      stripe: !!document.getElementById("nav-AssociateStripe"),
      captcha: /digitar os caracteres|enter the characters|não somos robôs|unusual traffic/i.test(
        document.body?.innerText?.slice(0, 3000) ?? "",
      ),
    }));
    if (dom.captcha) return "unknown";
    const apiEligible = /"eligible"\s*:/.test(apiBody);
    if (apiEligible || dom.getLink) return "eligible";
    if (apiSeen && apiBody) return "ineligible"; // API respondeu sem eligible
    return "unknown";
  } catch {
    return "unknown";
  } finally {
    page.off("response", onResp);
  }
}

async function main() {
  if (!existsSync(STATE)) {
    console.error(
      "Sessao nao encontrada. Rode antes: npx tsx scripts/amz-login.ts",
    );
    process.exit(1);
  }

  const verified: string[] = existsSync(VERIFIED_FILE)
    ? JSON.parse(readFileSync(VERIFIED_FILE, "utf8"))
    : [];
  const verifiedSet = new Set(ALL ? [] : verified);

  const products = await prisma.product.findMany({
    where: { active: true, externalId: { startsWith: "amz:" } },
    select: { id: true, externalId: true, title: true },
    orderBy: { createdAt: "asc" },
  });
  const pending = products
    .filter((p) => !verifiedSet.has(p.externalId!))
    .slice(0, LIMIT);

  console.log(
    `${products.length} amz: ativos | ${verifiedSet.size} ja verificados | ${pending.length} para verificar.\n`,
  );
  if (!pending.length) return;

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    storageState: STATE,
    locale: "pt-BR",
  });
  const page = await ctx.newPage();
  // esquenta a sessao
  await page.goto("https://www.amazon.com.br/", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await sleep(3000);

  let ok = 0, removed = 0, unknown = 0, consecutiveUnknown = 0;
  const newlyVerified: string[] = [];

  for (const p of pending) {
    const asin = p.externalId!.slice(4);
    const verdict = await checkAsin(page, asin);
    if (verdict === "eligible") {
      ok++;
      consecutiveUnknown = 0;
      newlyVerified.push(p.externalId!);
    } else if (verdict === "ineligible") {
      removed++;
      consecutiveUnknown = 0;
      newlyVerified.push(p.externalId!);
      await prisma.product.update({
        where: { id: p.id },
        data: { active: false },
      });
      console.log(`  ✗ INELEGIVEL (desativado): ${asin} ${p.title.slice(0, 50)}`);
    } else {
      unknown++;
      consecutiveUnknown++;
      console.log(`  ? sem sinal: ${asin} ${p.title.slice(0, 50)}`);
    }
    if (verdict !== "unknown") {
      console.log(`  ✓ elegivel: ${asin}`);
    }
    // 3 desconhecidos seguidos = sessao provavelmente morta — aborta
    if (consecutiveUnknown >= 3) {
      console.log(
        "\n3 verificacoes sem sinal seguidas — sessao expirou ou Amazon bloqueou.\n" +
          "Rode `npx tsx scripts/amz-login.ts` de novo e repita.",
      );
      break;
    }
    await sleep(DELAY);
  }

  await browser.close();

  if (newlyVerified.length) {
    const merged = [...new Set([...verified, ...newlyVerified])];
    mkdirSync(dirname(VERIFIED_FILE), { recursive: true });
    writeFileSync(VERIFIED_FILE, JSON.stringify(merged));
  }

  console.log(
    `\nPronto: ${ok} elegiveis | ${removed} desativados | ${unknown} sem sinal.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
