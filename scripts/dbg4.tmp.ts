import { chromium } from "playwright";
import { homedir } from "os";
import { join } from "path";
process.env.LD_LIBRARY_PATH = `${join(homedir(), ".local/share/ofertacoradar-chromelibs/x86_64-linux-gnu")}:${process.env.LD_LIBRARY_PATH ?? ""}`;
async function main() {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ storageState: join(homedir(), ".config/ofertacoradar/amz-state.json"), locale: "pt-BR" });
  const p = await ctx.newPage();
  await p.goto("https://www.amazon.com.br/dp/B0DH7357F1", { waitUntil: "load", timeout: 60000 });
  await p.waitForTimeout(8000);
  const d = await p.evaluate(`(() => {
    const body = document.body.innerText;
    const lines = body.split("\\n").filter(l => /%|OFF|off|desconto|De:|R\\$/.test(l)).slice(0, 40);
    return { lines, hasBasis: !!document.querySelector(".basisPrice"), hasDeal: /dealprice|DealPrice/.test(document.documentElement.innerHTML) };
  })()`);
  console.log(JSON.stringify(d, null, 1));
  await b.close();
}
main().catch(e => { console.error(e); process.exit(1); });
