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
    const txt = (sel) => { const el = document.querySelector(sel); return el ? el.textContent.trim().slice(0,60) : null; };
    const all = (sel) => [...document.querySelectorAll(sel)].slice(0,6).map(e => e.textContent.trim().slice(0,40));
    return {
      corePrice: txt("#corePriceDisplay .a-offscreen"),
      coreFeat: txt("#corePrice_feature_div .a-offscreen"),
      aprice: txt(".a-price .a-offscreen"),
      atextprice: txt(".a-text-price .a-offscreen"),
      ourprice: txt("#priceblock_ourprice"),
      basis: txt(".basisPrice .a-offscreen"),
      listPrice: txt("#listPrice"),
      allAText: all(".a-text-price .a-offscreen"),
      allABase: all(".a-price .a-offscreen"),
      dealprice: txt("#priceblock_dealprice"),
      saveprice: txt("#priceSaving"),
      offscreenSample: all(".a-offscreen").slice(0,10),
    };
  })()`);
  console.log(JSON.stringify(d, null, 1));
  await b.close();
}
main().catch(e => { console.error(e); process.exit(1); });
