// Login interativo na Amazon BR para capturar a sessao de associado.
// Abre um Chromium visivel, voce faz login normalmente (senha/2FA/captcha
// ficam entre voce e a Amazon — nada passa por mim), e o script salva os
// cookies em ~/.config/ofertacoradar/amz-state.json (fora do repo).
//
// Uso: npx tsx scripts/amz-login.ts
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const STATE = join(homedir(), ".config", "ofertacoradar", "amz-state.json");
// Libs do Chromium instaladas localmente (sem sudo) — o Chromium do
// Playwright nao acha libnss/libnss3 etc no sistema minimo.
process.env.LD_LIBRARY_PATH = `${join(
  homedir(),
  ".local/share/ofertacoradar-chromelibs/x86_64-linux-gnu",
)}:${process.env.LD_LIBRARY_PATH ?? ""}`;

async function main() {
  mkdirSync(join(STATE, ".."), { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({
    locale: "pt-BR",
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  await page.goto("https://www.amazon.com.br/gp/bestsellers", {
    waitUntil: "domcontentloaded",
  });

  console.log(
    "\n>>> Faca login na janela do navegador (se ainda nao estiver).\n" +
      ">>> Quando a barra da SiteStripe aparecer no topo, volte aqui e\n" +
      ">>> pressione ENTER neste terminal para salvar a sessao.\n",
  );

  // Espera o usuario apertar enter no terminal
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
    process.stdin.resume();
  });

  // Confere se a sessao parece logada (SiteStripe ou saudar nominal)
  const bodyText = await page.evaluate(() => document.body?.innerText ?? "");
  const looksLogged =
    /sitestripe|olá,|ola,|sair|conta e listas|listais/i.test(bodyText) ||
    (await page.locator("#navbar #nav-link-accountList").count()) > 0;

  if (!looksLogged) {
    console.log(
      "\nAviso: nao detectei sessao de associado com certeza. Salvando mesmo\n" +
        "assim — se o scrape de elegibilidade falhar, refaca o login.\n",
    );
  }

  await ctx.storageState({ path: STATE });
  console.log(`\nSessao salva em ${STATE}`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
