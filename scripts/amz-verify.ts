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
import { purgeProductsByIds } from "../src/lib/product-purge";
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
const BLOCKED_FILE = join(
  homedir(),
  ".config",
  "ofertacoradar",
  "amz-blocked.json",
);
const LIBS = join(
  homedir(),
  ".local/share/ofertacoradar-chromelibs/x86_64-linux-gnu",
);
process.env.LD_LIBRARY_PATH = `${LIBS}:${process.env.LD_LIBRARY_PATH ?? ""}`;

const WEEK = 7 * 24 * 3600 * 1000;
// blocklist: {externalId: expiresAt} — 0 = permanente (inelegivel),
// timestamp = temporario (sem desconto; re-checa apos expirar)
function loadBlocked(): Record<string, number> {
  if (!existsSync(BLOCKED_FILE)) return {};
  try {
    const raw = JSON.parse(readFileSync(BLOCKED_FILE, "utf8"));
    if (Array.isArray(raw)) {
      // formato legado (lista de ASINs) -> temporario de 7 dias
      return Object.fromEntries(raw.map((a: string) => [a, Date.now() + WEEK]));
    }
    return raw;
  } catch {
    return {};
  }
}
function saveBlocked(map: Record<string, number>) {
  mkdirSync(dirname(BLOCKED_FILE), { recursive: true });
  writeFileSync(BLOCKED_FILE, JSON.stringify(map));
}

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
    // pra concluir nada; depois espera a chamada /associate OU o botao
    // "Obter link" (ate ~20s). Paginas lentas sob carga precisam de
    // mais paciencia — sem isso tudo vira "sem sinal".
    await page
      .waitForSelector("#nav-AssociateStripe", { timeout: 20000 })
      .catch(() => {});
    for (let i = 0; i < 40; i++) {
      if (apiBody) break;
      const gl = await page
        .evaluate(`!!document.getElementById("amzn-ss-get-link-button")`)
        .catch(() => false);
      if (gl) {
        await sleep(1200); // botao visivel — da mais um tempo pra API chegar
        break;
      }
      await sleep(500);
    }
    await sleep(1000);
    // evaluate com STRING: funcoes TS viram __name() do esbuild e quebram
    // no browser. String nao passa pelo transform.
    const dom = (await page.evaluate(`(() => {
      const txt = (sel) => document.querySelector(sel)?.textContent?.trim() ?? "";
      // escopo do bloco de preco — celwidget#corePrice_desktop e
      // #corePrice*_feature_div sao os containers reais; .a-price-range
      // e faixa de variacao ("R$559 - R$699"), NAO desconto
      const scope = document.querySelector(
        "#corePrice_desktop, #corePriceDisplay_desktop_feature_div, #corePriceDisplay_feature_div, #corePrice_feature_div, #apex_desktop, #centerCol",
      ) || document.body;
      const pick = (sel) => {
        const el = scope.querySelector(sel);
        return el ? el.textContent.trim() : "";
      };
      const lists = [...scope.querySelectorAll(".a-text-price .a-offscreen")]
        .filter((e) => !e.closest(".a-price-range"))
        .map((e) => e.textContent.trim());
      const saveTxt =
        pick("#priceSaving") ||
        pick("#priceblock_saveprice") ||
        pick(".a-color-price.a-size-small");
      return {
        getLink: !!document.getElementById("amzn-ss-get-link-button"),
        stripe: !!document.getElementById("nav-AssociateStripe"),
        captcha: /digitar os caracteres|enter the characters|não somos robôs|unusual traffic/i.test(
          document.body?.innerText?.slice(0, 3000) ?? "",
        ),
        price:
          pick(".a-price .a-offscreen") ||
          txt("#corePriceDisplay .a-offscreen") ||
          txt(".a-price .a-offscreen"),
        lists,
        saveTxt,
      };
    })()`)) as {
      getLink: boolean;
      stripe: boolean;
      captcha: boolean;
      price: string;
      lists: string[];
      saveTxt: string;
    };
    const prices: PagePrices = {
      price: brlNum(dom.price),
      oldPrice: null,
    };
    // preco de tabela = .a-text-price riscado MAIOR que o atual,
    // fora de .a-price-range; fallback: % de economia ("Voce
    // economizou R$ X (Y%)") -> oldPrice = price/(1-pct)
    if (prices.price) {
      for (const l of dom.lists) {
        const v = brlNum(l);
        if (v && v > prices.price) {
          prices.oldPrice = v;
          break;
        }
      }
      if (prices.oldPrice == null) {
        const pct = dom.saveTxt.match(/(\d{1,2})\s*%/);
        if (pct) {
          const p = Number(pct[1]);
          if (p > 0 && p < 90)
            prices.oldPrice = Math.round((prices.price / (1 - p / 100)) * 100) / 100;
        }
      }
    }
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
  // blocklist: inelegivel = permanente (0); sem desconto = 7 dias.
  // Entrada expirada torna o produto pendente de novo (volta se entrar
  // em oferta — o scrape o reativa e o verify re-julga).
  const blockedMap = loadBlocked();
  let blockChanged = false;
  const reject = async (
    asin: string,
    productId: number,
    why: string,
    permanent: boolean,
  ) => {
    await purgeProductsByIds([productId]);
    blockedMap[`amz:${asin}`] = permanent ? 0 : Date.now() + WEEK;
    blockChanged = true;
    console.log(
      `  ✗ ${why} (removido${permanent ? " + bloqueado definitivo" : " + re-check em 7d"}): ${asin}`,
    );
  };

  const products = await prisma.product.findMany({
    where: { active: true, externalId: { startsWith: "amz:" } },
    select: { id: true, externalId: true, title: true, price: true, oldPrice: true },
    orderBy: { createdAt: "asc" },
  });
  const pending = products
    .filter((p) => {
      const ext = p.externalId!;
      if (!verifiedSet.has(ext)) return true;
      const t = blockedMap[ext];
      return t != null && t > 0 && t <= Date.now(); // bloqueio temporario expirou
    })
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

  let ok = 0, removed = 0, nodesc = 0, unknown = 0, consecutiveUnknown = 0;
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
      // Regra: SO COMISSAO importa — elegivel (PA-API) fica no site
      // mesmo sem desconto detectado. O verify so remove quem NAO
      // pode gerar comissao (inelegivel = bloqueio permanente).
      ok++;
      consecutiveUnknown = 0;
      newlyVerified.push(p.externalId!);
      // tinha bloqueio temporario? aprovou -> desbloqueia de vez
      if (blockedMap[p.externalId!] > 0) {
        delete blockedMap[p.externalId!];
        blockChanged = true;
      }
      if (prices.price != null && prices.oldPrice == null) {
        nodesc++;
        console.log(`  ✓ elegivel sem desconto (mantido): ${asin}`);
      } else {
        console.log(`  ✓ elegivel: ${asin}`);
      }
    } else if (verdict === "ineligible") {
      removed++;
      consecutiveUnknown = 0;
      newlyVerified.push(p.externalId!);
      await reject(asin, p.id, "INELEGIVEL", true);
    } else {
      unknown++;
      consecutiveUnknown++;
      console.log(`  ? sem sinal: ${asin} ${p.title.slice(0, 50)}`);
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
  if (blockChanged) saveBlocked(blockedMap);

  console.log(
    `\nPronto: ${ok} elegiveis (${nodesc} sem desconto — mantidos) | ${removed} inelegiveis removidos | ${unknown} sem sinal.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
