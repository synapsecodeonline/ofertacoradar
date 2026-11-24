// Scrape de catalogo Mercado Livre via sessao logada (Playwright).
// O ML bloqueia API de precos (403 PolicyAgent) e busca anonima
// (account-verification), mas com a sessao do ml-login.ts as paginas
// lista.mercadolivre.com.br/*, /mais-vendidos, /black-friday e /c/* abrem.
//
// Uso:  npx tsx --env-file=.env scripts/ml-scrape.ts [opcoes]
//   --pages N     limite de paginas de busca (default: 1 por query)
//   --delay MS    pausa entre paginas (default: 5000)
//   --only TRECHO filtra queries/fontes que contenham o trecho
//   --dry         so lista, nao grava
//   --max-new N   maximo de produtos NOVOS gravados nesta execucao
//
// Rodar local (IP residencial + sessao). Sessao expira — se voltar
// account-verification em tudo, refaca scripts/ml-login.ts.
import { chromium, type BrowserContext, type Page } from "playwright";
import { upsertByExternalId } from "../src/lib/upsert";
import { prisma } from "../src/lib/db";
import { homedir } from "os";
import { join } from "path";

const PROFILE = join(homedir(), ".config/ofertacoradar/ml-profile2");
process.env.LD_LIBRARY_PATH = `${join(
  homedir(),
  ".local/share/ofertacoradar-chromelibs/x86_64-linux-gnu",
)}:${process.env.LD_LIBRARY_PATH ?? ""}`;

const QUERIES = [
  "iphone", "notebook", "ps5", "smart tv", "fone de ouvido bluetooth",
  "airfryer", "perfume", "tenis", "smartwatch", "drone",
  "geladeira", "lava e seca", "aspirador de po", "cafeteira",
  "console", "monitor gamer", "cadeira gamer", "tablet",
];
const DEAL_PAGES = [
  "https://www.mercadolivre.com.br/mais-vendidos",
  "https://www.mercadolivre.com.br/black-friday",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const MAX_PAGES = Number(arg("pages") ?? 1);
const DELAY = Number(arg("delay") ?? 5000);
const ONLY = arg("only")?.toLowerCase();
const DRY = process.argv.includes("--dry");
const MAX_NEW = Number(arg("max-new") ?? Infinity);

interface Found {
  catalogId: string;
  title: string;
  price: number | null;
  oldPrice: number | null;
  imageUrl: string | null;
  url: string;
}

// Extrai os cards da pagina renderizada (DOM real — o HTML vem com
// web components, entao regex no source nao resolve).
// NOTA: page.evaluate recebe uma STRING — funcao TS seria serializada
// com helpers do esbuild (__name) que nao existem no browser.
const EXTRACT_FN = `(() => {
  const num = (el) => {
    if (!el) return null;
    const f = el.querySelector(".andes-money-amount__fraction")?.textContent;
    return f ? Number(f.replace(/[^\\d]/g, "")) || null : null;
  };
  const out = [];
  const cards = document.querySelectorAll("li.ui-search-layout__item");
  for (const card of cards) {
    const a = card.querySelector("a.poly-component__title");
    const href = a?.href ?? "";
    const m = href.match(/\\/p\\/(MLB\\d+)/);
    if (!a || !m) continue;
    const title = (a.textContent ?? "").replace(/\\s+/g, " ").trim();
    const price = num(card.querySelector(".poly-price__current .andes-money-amount"));
    const oldPrice = num(card.querySelector(".andes-money-amount--previous"));
    const img = card.querySelector("img.poly-component__picture");
    let imageUrl = null;
    if (img) {
      const set = img.getAttribute("srcset") ?? "";
      const cands = set.split(",").map((s) => s.trim().split(/\\s+/)[0]).filter(Boolean);
      imageUrl = cands.find((u) => u.includes("-L.webp")) ?? cands[cands.length - 1] ?? img.src ?? null;
      imageUrl = imageUrl?.replace(/&amp;/g, "&") ?? null;
    }
    out.push({
      catalogId: m[1],
      title,
      price,
      oldPrice: oldPrice && price && oldPrice > price ? oldPrice : null,
      imageUrl,
      url: "https://www.mercadolivre.com.br/p/" + m[1],
    });
  }
  return out;
})()`;

async function extract(page: Page): Promise<Found[]> {
  return (await page.evaluate(EXTRACT_FN)) as Found[];
}

async function scrapePage(
  page: Page,
  url: string,
): Promise<{ items: Found[]; blocked: boolean }> {
  try {
    const res = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(3000);
    // bloqueio = redirect para tela de verificacao (URL final). O HTML
    // das paginas validas menciona "captcha"/"account-verification" em
    // strings de JS — nao serve como sinal.
    const blocked = /account-verification|captcha\/wall|web-risk-verification/i.test(
      page.url(),
    );
    if (blocked) {
      console.log(`  BLOQUEADO -> ${page.url().slice(0, 90)}`);
      return { items: [], blocked: true };
    }
    if (!res || res.status() >= 400) {
      console.log(`  HTTP ${res?.status()}`);
      return { items: [], blocked: false };
    }
    const items = await extract(page);
    return { items, blocked: false };
  } catch (e) {
    console.log(
      `  erro: ${e instanceof Error ? e.message.slice(0, 90) : e}`,
    );
    return { items: [], blocked: false };
  }
}

let blockedStreak = 0;

async function run() {
  const ctx: BrowserContext = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1366, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    // @ts-expect-error
    window.chrome = { runtime: {} };
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  // warmup: home + scroll humano (sem isso o ML desconfia)
  await page.goto("https://www.mercadolivre.com.br/", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(600);
  }
  console.log("sessao:", page.url());

  // fontes: paginas de oferta + buscas (_Desde_N = offset de 48/pagina)
  const urls: string[] = [];
  for (const d of DEAL_PAGES) if (!ONLY || d.includes(ONLY)) urls.push(d);
  for (const q of QUERIES) {
    if (ONLY && !q.includes(ONLY)) continue;
    for (let p = 0; p < MAX_PAGES; p++) {
      const off = p * 48;
      // lista.mercadolivre.com.br usa slug com hifens — %20 devolve
      // pagina sem cards
      const slug = q.trim().toLowerCase().replace(/\s+/g, "-");
      urls.push(
        `https://lista.mercadolivre.com.br/${encodeURIComponent(slug)}${off ? `?_Desde_${off}` : ""}`,
      );
    }
  }
  console.log(`${urls.length} pagina(s).\n`);

  const existing = new Set(
    (
      await prisma.product.findMany({
        where: { externalId: { startsWith: "ml:" } },
        select: { externalId: true },
      })
    ).map((p) => p.externalId!),
  );

  let total = 0, newCount = 0, updated = 0, skipped = 0, errors = 0, quotaHit = false;
  const seen = new Set<string>();

  for (const url of urls) {
    if (quotaHit) break;
    console.log(`→ ${url.slice(0, 100)}`);
    const { items, blocked } = await scrapePage(page, url);
    blockedStreak = blocked ? blockedStreak + 1 : 0;
    if (blockedStreak >= 3) {
      console.log(
        "\n3 bloqueios seguidos — sessao provavelmente expirou.\n" +
          "Rode: npx tsx scripts/ml-login.ts",
      );
      break;
    }
    if (items.length === 0) {
      console.log("  0 cards");
    } else {
      console.log(`  ${items.length} cards`);
    }
    for (const it of items) {
      if (seen.has(it.catalogId)) {
        skipped++;
        continue;
      }
      seen.add(it.catalogId);
      total++;
      const ext = `ml:${it.catalogId}`;
      const isNew = !existing.has(ext);
      if (!it.price || !it.imageUrl) {
        skipped++;
        continue;
      }
      if (isNew && newCount >= MAX_NEW) {
        quotaHit = true;
        break;
      }
      if (DRY) {
        console.log(
          `   [dry] ${it.catalogId} | ${it.title.slice(0, 55)} | R$ ${it.price}`,
        );
        continue;
      }
      try {
        // upsert tambem nos existentes: preco do ML muda e o card
        // precisa refletir — upsertByExternalId so grava PriceHistory
        // quando o preco muda de verdade.
        await upsertByExternalId({
          externalId: ext,
          title: it.title,
          imageUrl: it.imageUrl,
          price: it.price,
          oldPrice: it.oldPrice ?? undefined,
          merchant: "Mercado Livre",
          url: it.url,
        });
        if (isNew) newCount++;
        else updated++;
      } catch (e) {
        console.log(
          `   erro ${it.catalogId}: ${e instanceof Error ? e.message.slice(0, 80) : e}`,
        );
        errors++;
      }
      await sleep(120);
    }
    await sleep(DELAY);
  }

  await ctx.close();
  const ativos = await prisma.product.count({
    where: { active: true, externalId: { startsWith: "ml:" } },
  });
  console.log(
    `\nPronto: ${total} unicos | ${newCount} novos + ${updated} atualizados | ${skipped} pulados | ${errors} erros.\n` +
      `ML ativos no site: ${ativos}`,
  );
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
