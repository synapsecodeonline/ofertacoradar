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
import { discountPctOf } from "../src/lib/format";
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
type PagePrices = { price: number | null; oldPrice: number | null };

const brlNum = (s: string | null | undefined) => {
  if (!s) return null;
  const n = Number(s.replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", "."));
  return n > 0 ? n : null;
};

async function checkAsin(
  page: import("playwright").Page,
  asin: string,
): Promise<{ verdict: Verdict; prices: PagePrices }> {
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
    // espera a barra SiteStripe renderizar (ate 20s) — sem ela nao da
    // pra concluir nada; depois espera a chamada /associate (ate 10s)
    await page
      .waitForSelector("#nav-AssociateStripe", { timeout: 20000 })
      .catch(() => {});
    for (let i = 0; i < 20 && !apiBody; i++) await sleep(500);
    await sleep(1500);
    // evaluate com STRING: funcoes TS viram __name() do esbuild e quebram
    // no browser. String nao passa pelo transform.
    const dom = (await page.evaluate(`(() => {
      const txt = (sel) => document.querySelector(sel)?.textContent?.trim() ?? "";
      return {
        getLink: !!document.getElementById("amzn-ss-get-link-button"),
        stripe: !!document.getElementById("nav-AssociateStripe"),
        captcha: /digitar os caracteres|enter the characters|não somos robôs|unusual traffic/i.test(
          document.body?.innerText?.slice(0, 3000) ?? "",
        ),
        // precos da pagina do produto — listagem nao mostra "De: R$ X",
        // mas a pagina sim (a-text-price/basisPrice = preco de tabela)
        price:
          txt("#corePriceDisplay .a-offscreen") ||
          txt("#corePrice_feature_div .a-offscreen") ||
          txt(".a-price .a-offscreen"),
        listPrice:
          txt(".a-text-price .a-offscreen") ||
          txt("#priceblock_ourprice") ||
          txt(".basisPrice .a-offscreen") ||
          txt("#listPrice"),
      };
    })()`)) as {
      getLink: boolean;
      stripe: boolean;
      captcha: boolean;
      price: string;
      listPrice: string;
    };
    const prices: PagePrices = {
      price: brlNum(dom.price),
      oldPrice: null,
    };
    const list = brlNum(dom.listPrice);
    if (list && prices.price && list > prices.price) prices.oldPrice = list;
    if (dom.captcha) return { verdict: "unknown", prices };
    const apiEligible = /"eligible"\s*:/.test(apiBody);
    if (apiEligible || dom.getLink)
      return { verdict: "eligible", prices };
    if (apiSeen && apiBody) return { verdict: "ineligible", prices };
    return { verdict: "unknown", prices };
  } catch {
    return { verdict: "unknown", prices: { price: null, oldPrice: null } };
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
    select: { id: true, externalId: true, title: true, price: true, oldPrice: true },
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
  const saveProgress = () => {
    const merged = [...new Set([...verified, ...newlyVerified])];
    mkdirSync(dirname(VERIFIED_FILE), { recursive: true });
    writeFileSync(VERIFIED_FILE, JSON.stringify(merged));
  };

  for (const p of pending) {
    const asin = p.externalId!.slice(4);
    const { verdict, prices } = await checkAsin(page, asin);
    // aprofunda a visita: atualiza preco/preco de tabela (desconto) do produto
    if (verdict !== "unknown" && prices.price != null) {
      const oldPrice = prices.oldPrice; // null = sem desconto na pagina
      if (prices.price !== p.price || oldPrice !== p.oldPrice) {
        await prisma.product.update({
          where: { id: p.id },
          data: {
            price: prices.price,
            oldPrice,
            discountPct: discountPctOf({ price: prices.price, oldPrice }),
          },
        });
      }
    }
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
    if (verdict === "eligible") {
      console.log(`  ✓ elegivel: ${asin}`);
    }
    if (verdict !== "unknown") {
      saveProgress(); // grava a cada verificado — nao perde progresso se cair
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

  saveProgress();

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
