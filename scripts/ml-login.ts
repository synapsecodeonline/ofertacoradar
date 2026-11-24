// Login interativo no Mercado Livre para capturar a sessao.
// Abre um Chromium visivel, voce faz login normalmente (senha/2FA/captcha
// ficam entre voce e o ML — nada passa por mim), e o script salva os
// cookies no perfil persistente ~/.config/ofertacoradar/ml-profile2
// (o mesmo que os scrapers usam — sessoes ML sao por perfil, nao JSON).
//
// Uso: npx tsx scripts/ml-login.ts
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PROFILE = join(homedir(), ".config", "ofertacoradar", "ml-profile2");
process.env.LD_LIBRARY_PATH = `${join(
  homedir(),
  ".local/share/ofertacoradar-chromelibs/x86_64-linux-gnu",
)}:${process.env.LD_LIBRARY_PATH ?? ""}`;

async function main() {
  mkdirSync(PROFILE, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
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
  await page.goto("https://www.mercadolivre.com.br/", {
    waitUntil: "domcontentloaded",
  });

  console.log(
    "\n>>> Faca login na janela do navegador (email/senha/2FA sao seus).\n" +
      ">>> Se aparecer 'verificacao de conta', resolva normalmente.\n" +
      ">>> Quando estiver logado (seu nome no canto), volte aqui e\n" +
      ">>> pressione ENTER neste terminal para salvar a sessao.\n",
  );

  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
    process.stdin.resume();
  });

  const bodyText = await page.evaluate(() => document.body?.innerText ?? "");
  const looksLogged =
    /sair|minha conta|compras|vender|boas-vindas|olá|ola,/i.test(bodyText) &&
    !/faça login|iniciar sessão|crie a sua conta/i.test(bodyText.slice(0, 3000));

  console.log(
    looksLogged
      ? "\nSessao parece logada — perfil salvo."
      : "\nAviso: nao detectei login com certeza. Perfil salvo mesmo assim —\n" +
          "se o scrape falhar, refaca o login.",
  );
  await ctx.close();
  console.log(`Perfil em ${PROFILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
