import { createHash, createHmac } from "node:crypto";
import { syncPrisma as prisma } from "./db";
import { purgeProducts } from "./product-purge";
import { discountPctOf } from "./format";
import { resolveCategory, resolveSubtype } from "./categories";
import {
  LOCK_STALE_MS,
  acquireLock,
  beat,
  busyFresh,
  clearError,
  errorBackoffActive,
  noteError,
  releaseLock,
  startHeartbeat,
} from "./sync-lock";
import type { SyncSourceStatus } from "./syncer";

// Fonte Amazon Associates (PA-API 5.0).
// Credenciais: AMZ_API_KEY + AMZ_API_SECRET (Product Advertising API),
// AMZ_TAG = Partner Tag de associados (ex: synapsecodeon-20).
// Sem credenciais o sync fica desligado (maybeSyncAmazon retorna cedo).
const STATE_KEY = "amazon";
const BUDGET_MS = 45_000;
const CYCLE_TTL_MS = 60_000;

const MARKETPLACE = () => process.env.AMZ_MARKETPLACE ?? "www.amazon.com.br";
const HOST = () => process.env.AMZ_HOST ?? "webservices.amazon.com.br";
const REGION = () => process.env.AMZ_REGION ?? "us-east-1";
const PARTNER_TAG = () => process.env.AMZ_TAG ?? "synapsecodeon-20";

// Termos de busca padrao — cobrem as categorias quentes do varejo BR.
// Personalizavel via AMZ_KEYWORDS="termo1,termo2,..."
const DEFAULT_KEYWORDS = [
  "eletronicos",
  "informatica",
  "casa e cozinha",
  "beleza e perfumaria",
  "moda feminina",
  "moda masculina",
  "brinquedos",
  "livros",
  "suplementos",
  "pet shop",
];

function keywords(): string[] {
  const raw = process.env.AMZ_KEYWORDS;
  if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  return DEFAULT_KEYWORDS;
}

// ---- AWS Signature V4 (PA-API exige) ----

const sha256Hex = (s: string) =>
  createHash("sha256").update(s).digest("hex");
const hmac = (key: string | Buffer, s: string) =>
  createHmac("sha256", key).update(s).digest();

function amzDate(): { amz: string; day: string } {
  const d = new Date();
  const amz = d.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz, day: amz.slice(0, 8) };
}

async function paapiPost(
  operation: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const accessKey = process.env.AMZ_API_KEY!;
  const secretKey = process.env.AMZ_API_SECRET!;
  const host = HOST();
  const region = REGION();
  const service = "ProductAdvertisingAPI";
  const { amz, day } = amzDate();
  const body = JSON.stringify(payload);
  const payloadHash = sha256Hex(body);

  const signedHeaders =
    "content-encoding;content-type;host;x-amz-date;x-amz-target";
  const canonicalHeaders = [
    `content-encoding:amz-1.0`,
    `content-type:application/json; charset=utf-8`,
    `host:${host}`,
    `x-amz-date:${amz}`,
    `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`,
    "",
  ].join("\n");
  const canonicalRequest = [
    "POST",
    `/paapi5/${operation.toLowerCase()}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${day}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const kDate = hmac(`AWS4${secretKey}`, day);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign)
    .digest("hex");
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${host}/paapi5/${operation.toLowerCase()}`, {
    method: "POST",
    headers: {
      "content-encoding": "amz-1.0",
      "content-type": "application/json; charset=utf-8",
      "x-amz-date": amz,
      "x-amz-target": `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`,
      authorization,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PA-API ${operation} HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

// ---- SearchItems ----

const SEARCH_RESOURCES = [
  "Images.Primary.Large",
  "ItemInfo.Title",
  "ItemInfo.Features",
  "ItemInfo.ByLineInfo",
  "Offers.Listings.Price",
  "Offers.Listings.SavingBasis",
  "Offers.Listings.Availability.Type",
  "Offers.Summaries.LowestPrice",
];

interface AmzItem {
  asin: string;
  title: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  oldPrice?: number;
  merchant?: string;
}

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

// Preco vindo de API terceira: numero, "38.09", "38,09" ou "R$ 1.234,56"
function parsePriceVal(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v !== "string") return undefined;
  const s = v.replace(/[^\d.,]/g, "");
  if (!s) return undefined;
  // formato BR: ponto milhar + virgula decimal
  const n = s.includes(",")
    ? Number(s.replace(/\./g, "").replace(",", "."))
    : Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseSearchItems(json: Record<string, unknown>): AmzItem[] {
  const items = (json.SearchResult as Record<string, unknown> | undefined)
    ?.Items as Record<string, unknown>[] | undefined;
  if (!Array.isArray(items)) return [];
  const out: AmzItem[] = [];
  for (const it of items) {
    const asin = it.ASIN as string | undefined;
    const title = (
      it.ItemInfo as Record<string, unknown> | undefined
    )?.Title as Record<string, unknown> | undefined;
    const name = (title?.DisplayValue as string | undefined)?.trim();
    if (!asin || !name) continue;

    const images = it.Images as Record<string, unknown> | undefined;
    const primary = images?.Primary as Record<string, unknown> | undefined;
    const large = primary?.Large as Record<string, unknown> | undefined;

    const offers = it.Offers as Record<string, unknown> | undefined;
    const listings = offers?.Listings as Record<string, unknown>[] | undefined;
    const listing = listings?.[0];
    const price = num(
      (listing?.Price as Record<string, unknown> | undefined)?.Amount,
    );
    const saving = num(
      (listing?.SavingBasis as Record<string, unknown> | undefined)?.Amount,
    );
    const byLine = (
      it.ItemInfo as Record<string, unknown> | undefined
    )?.ByLineInfo as Record<string, unknown> | undefined;
    const brand = (byLine?.Brand as Record<string, unknown> | undefined)
      ?.DisplayValue as string | undefined;

    out.push({
      asin,
      title: name,
      description: Array.isArray(
        (it.ItemInfo as Record<string, unknown> | undefined)?.Features,
      )
        ? ((it.ItemInfo as Record<string, unknown>).Features as unknown[])
            .filter((f): f is string => typeof f === "string")
            .slice(0, 5)
            .join("\n")
        : undefined,
      imageUrl: large?.URL as string | undefined,
      price,
      oldPrice: saving && price != null && saving > price ? saving : undefined,
      merchant: brand?.trim() || "Amazon",
    });
  }
  return out;
}

// ---- Sync ----

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Mesmo formato de link que o SiteStripe gera (GetLink):
// tag + linkCode=ogi&th=1&psc=1
export function amzAffiliateUrl(url: string) {
  const u = new URL(url);
  u.searchParams.set("tag", PARTNER_TAG());
  u.searchParams.set("linkCode", "ogi");
  u.searchParams.set("th", "1");
  u.searchParams.set("psc", "1");
  return u.toString();
}

export function amzUrl(asin: string) {
  return `https://www.amazon.com.br/dp/${asin}`;
}

async function upsertAmz(p: AmzItem) {
  const externalId = `amz:${p.asin}`;
  const url = amzUrl(p.asin);
  const affiliateUrl = amzAffiliateUrl(url);
  const category = resolveCategory(undefined, p.title, p.merchant ?? "Amazon");
  await prisma.product.upsert({
    where: { externalId },
    create: {
      externalId,
      title: p.title,
      description: p.description ?? null,
      imageUrl: p.imageUrl ?? null,
      price: p.price ?? null,
      oldPrice: p.oldPrice ?? null,
      discountPct: discountPctOf({ price: p.price, oldPrice: p.oldPrice }),
      category,
      subtype: resolveSubtype(category, p.title),
      merchant: "Amazon",
      url,
      affiliateUrl,
      active: true,
    },
    update: {
      title: p.title,
      description: p.description ?? null,
      imageUrl: p.imageUrl ?? null,
      price: p.price ?? null,
      oldPrice: p.oldPrice ?? null,
      discountPct: discountPctOf({ price: p.price, oldPrice: p.oldPrice }),
      category,
      subtype: resolveSubtype(category, p.title),
      merchant: "Amazon",
      url,
      affiliateUrl,
      active: true,
    },
  });
}

// Um ciclo = 1 pagina de SearchItems por keyword. PA-API devolve
// ~10 itens/pagina; rodamos as keywords em sequencia num bloco.
async function runAmazonCycle(): Promise<void> {
  const seen = new Set<string>();
  let completed = true;
  const deadline = Date.now() + BUDGET_MS;

  for (const kw of keywords()) {
    if (Date.now() > deadline) {
      completed = false;
      break;
    }
    try {
      const json = await paapiPost("SearchItems", {
        Keywords: kw,
        PartnerTag: PARTNER_TAG(),
        PartnerType: "Associates",
        Marketplace: MARKETPLACE(),
        ItemCount: 10,
        Resources: SEARCH_RESOURCES,
      });
      const items = parseSearchItems(json);
      for (const it of items) {
        seen.add(it.asin);
        await upsertAmz(it);
      }
      await beat(STATE_KEY);
      await sleep(400); // PA-API tem rate limit por segundo
    } catch (e) {
      await noteError(
        STATE_KEY,
        `keyword "${kw}": ${e instanceof Error ? e.message : String(e)}`,
      );
      // continua nas proximas keywords — uma falha nao derruba o ciclo
    }
  }

  // Reconciliacao so com ciclo completo: produto amz: que nao veio em
  // nenhuma busca sai do ar (mesma regra das outras fontes).
  if (completed && seen.size > 0) {
    const d = await purgeProducts({
      active: true,
      externalId: { startsWith: "amz:" },
      NOT: { externalId: { in: [...seen].map((a) => `amz:${a}`) } },
    });
    if (d > 0) console.log(`[amazon] ${d} itens fora das buscas removidos`);
  }

  await prisma.syncState.update({
    where: { key: STATE_KEY },
    data: { phase: "done", lastCycleAt: new Date(), page: 1 },
  });
}

async function runAmazonLocked() {
  const hb = startHeartbeat(STATE_KEY);
  try {
    await runAmazonCycle();
    await clearError(STATE_KEY);
  } catch (e) {
    console.error("[amazon] ciclo falhou:", e);
    await noteError(STATE_KEY, e instanceof Error ? e.message : String(e));
  } finally {
    await releaseLock(STATE_KEY, hb);
  }
}

// Chamado via after() nas paginas/cron: nunca bloqueia a resposta.
export async function maybeSyncAmazon(force = false) {
  if (!process.env.AMZ_API_KEY || !process.env.AMZ_API_SECRET) return;

  await prisma.syncState.upsert({
    where: { key: STATE_KEY },
    create: { key: STATE_KEY, phase: "q:0", page: 1 },
    update: {},
  });
  const state = await prisma.syncState.findUnique({
    where: { key: STATE_KEY },
  });
  if (!state) return;

  const now = Date.now();
  const lockFresh =
    state.busyAt && now - state.busyAt.getTime() < LOCK_STALE_MS;
  const cycleFresh =
    !force &&
    state.phase === "done" &&
    state.lastCycleAt &&
    now - state.lastCycleAt.getTime() < CYCLE_TTL_MS;
  if (lockFresh || cycleFresh) return;
  if (!force && (await errorBackoffActive(STATE_KEY))) return;
  if (!(await acquireLock(STATE_KEY))) return;

  await runAmazonLocked();
}

// ---- Cadastro manual (conta sem API liberada) ----
// O usuario cola um link/ASIN da Amazon no /admin; o servidor tenta
// ler os dados da pagina do produto. Se o scrape falhar (captcha,
// mudanca de layout), o formulario aceita preenchimento manual.

// Aceita ASIN puro (B0XXXXXXXXX) ou URL amazon.com.br/dp/...|gp/product/...
export function parseAsin(input: string): string | null {
  const s = input.trim();
  const m =
    s.match(/\/dp\/([A-Z0-9]{10})/i) ??
    s.match(/\/gp\/product\/([A-Z0-9]{10})/i) ??
    s.match(/\/gp\/aw\/d\/([A-Z0-9]{10})/i);
  if (m) return m[1].toUpperCase();
  return /^[A-Z0-9]{10}$/i.test(s) ? s.toUpperCase() : null;
}

export interface AmzLookup {
  asin: string;
  title?: string;
  price?: number;
  oldPrice?: number;
  imageUrl?: string;
  error?: string;
}

function parseBrl(s: string): number | undefined {
  const m = s.match(/R\$(?:\s|&nbsp;)*([\d]{1,3}(?:\.\d{3})*,\d{2}|[\d]+,\d{2})/);
  if (!m) return undefined;
  return Number(m[1].replace(/\./g, "").replace(",", "."));
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// SerpApi (engine=amazon_product) — API terceira que le a Amazon sem
// sofrer o bloqueio de datacenter. Gratis: 100 buscas/mes, suficiente
// para cadastro manual. Configurar SERPAPI_KEY.
async function lookupViaSerpApi(asin: string): Promise<AmzLookup | null> {
  const key = process.env.SERPAPI_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://serpapi.com/search.json?engine=amazon_product&asin=${asin}&amazon_domain=amazon.com.br&api_key=${key}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    const json = (await res.json()) as Record<string, unknown>;
    const p = json.product_results as Record<string, unknown> | undefined;
    if (!p || json.error) return { asin, error: String(json.error ?? "produto não encontrado") };
    // SerpApi devolve price/old_price como string formatada e
    // extracted_* como numero — aceita os dois
    const price = parsePriceVal(p.extracted_price ?? p.price);
    const wasPrice = parsePriceVal(p.extracted_old_price ?? p.old_price);
    const thumbnails = p.thumbnails as Record<string, unknown>[] | undefined;
    const imageUrl =
      (thumbnails?.[0]?.link as string | undefined) ??
      (p.thumbnail as string | undefined);
    return {
      asin,
      title: (p.title as string | undefined)?.slice(0, 300),
      price,
      oldPrice: wasPrice && price != null && wasPrice > price ? wasPrice : undefined,
      imageUrl,
    };
  } catch {
    return null; // cai pro scrape direto
  }
}

// Melhor esforco: SerpApi primeiro (contorna o bloqueio de IP de
// datacenter); se nao houver chave ou falhar, baixa a pagina do
// produto e extrai og:title, preco atual/lista e imagem principal.
// Amazon costuma devolver captcha para datacenter — nesse caso
// devolve error explicativo e o form aceita preenchimento manual.
export async function lookupAmazonProduct(asin: string): Promise<AmzLookup> {
  const viaApi = await lookupViaSerpApi(asin);
  if (viaApi?.title || viaApi?.error) return viaApi;
  const out: AmzLookup = { asin };
  try {
    const res = await fetch(amzUrl(asin), {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "accept-language": "pt-BR,pt;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    const html = await res.text();
    if (/captcha|robot check|digite os caracteres/i.test(html)) {
      out.error =
        "Amazon bloqueou a leitura automática (captcha). Preencha os dados manualmente.";
      return out;
    }
    if (!res.ok || html.length < 10_000) {
      out.error = `Página do produto indisponível (HTTP ${res.status}).`;
      return out;
    }

    // titulo: og:title ("Amazon.com.br: X: ...") ou #productTitle
    const ogTitle =
      html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ??
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i)?.[1];
    const pt = html.match(/<span[^>]+id="productTitle"[^>]*>([\s\S]*?)<\/span>/i)?.[1];
    const title = stripTags(pt ?? ogTitle ?? "")
      .replace(/^Amazon\.com\.br:\s*/i, "")
      .replace(/:\s*Amazon\.com\.br\s*$/i, "")
      .replace(/\s*:\s*Amazon\.com\.br.*$/i, "")
      .slice(0, 300);
    if (title) out.title = title;

    // preco atual: label de acessibilidade do preco-to-pay
    // ("R$ 38,09 com 45 por cento de desconto") — o primeiro "R$" da
    // regiao corePrice pode ser o preco antigo (basis price)
    const coreIdx = html.indexOf("corePrice_feature_div");
    const coreRegion = coreIdx >= 0 ? html.slice(coreIdx, coreIdx + 12000) : html;
    const payIdx = coreRegion.indexOf("apex-pricetopay-accessibility-label");
    const payRegion = payIdx >= 0 ? coreRegion.slice(payIdx, payIdx + 800) : coreRegion;
    const price = parseBrl(payRegion) ?? parseBrl(coreRegion);
    if (price != null) out.price = price;
    // preco antigo: "De: R$ X" (basis price da Amazon) ou offscreen
    // maior que o atual dentro da mesma regiao
    const deMatch = coreRegion.match(/De:\s*R\$\s?([\d]{1,3}(?:\.\d{3})*,\d{2}|[\d]+,\d{2})/);
    const oldFromDe = deMatch ? parseBrl(`R$ ${deMatch[1]}`) : undefined;
    const offscreens = [...coreRegion.matchAll(/a-offscreen[^>]*>([\s\S]*?)</g)].map(
      (m) => stripTags(m[1]),
    );
    const oldFromOff = offscreens
      .map(parseBrl)
      .filter((n): n is number => n != null && n > (price ?? 0))
      .sort((a, b) => a - b)[0];
    const old = oldFromDe ?? oldFromOff;
    if (old != null && old > (price ?? 0)) out.oldPrice = old;

    // imagem: #landingImage src, data-a-dynamic-image (JSON com &quot;)
    // ou og:image — a Amazon muda o formato com frequencia
    const dynImg =
      html.match(/id="landingImage"[^>]*data-a-dynamic-image="([^"]+)"/i)?.[1] ??
      html.match(/data-a-dynamic-image="([^"]+)"/i)?.[1];
    const dynUrl = dynImg?.match(/https:\/\/m\.media-amazon\.com\/images\/I\/[^&"]+/)?.[0];
    const img =
      html.match(/id="landingImage"[^>]+src="([^"]+)"/i)?.[1] ??
      dynUrl ??
      html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1] ??
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)?.[1];
    if (img) out.imageUrl = img.replace(/&amp;/g, "&");
  } catch (e) {
    out.error = `Falha ao ler a página: ${e instanceof Error ? e.message : e}`;
  }
  return out;
}

// Cadastro manual: upsert do produto amz:{ASIN} com dados informados
// (vindos do lookup ou digitados no formulario).
export async function addAmazonProduct(input: {
  asin: string;
  title: string;
  price?: number | null;
  oldPrice?: number | null;
  imageUrl?: string | null;
  description?: string | null;
}) {
  const externalId = `amz:${input.asin.toUpperCase()}`;
  const url = amzUrl(input.asin.toUpperCase());
  const affiliateUrl = amzAffiliateUrl(url);
  const p = {
    title: input.title,
    price: input.price ?? undefined,
    oldPrice: input.oldPrice ?? undefined,
  };
  const category = resolveCategory(undefined, input.title, "Amazon");
  return prisma.product.upsert({
    where: { externalId },
    create: {
      externalId,
      title: input.title,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      price: input.price ?? null,
      oldPrice: input.oldPrice ?? null,
      discountPct: discountPctOf(p),
      category,
      subtype: resolveSubtype(category, input.title),
      merchant: "Amazon",
      url,
      affiliateUrl,
      active: true,
    },
    update: {
      title: input.title,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      price: input.price ?? null,
      oldPrice: input.oldPrice ?? null,
      discountPct: discountPctOf(p),
      category,
      subtype: resolveSubtype(category, input.title),
      merchant: "Amazon",
      url,
      affiliateUrl,
      active: true,
    },
  });
}

// Versao para o botao "Sincronizar agora" do /admin.
export async function startAmazonSync(): Promise<{
  status: SyncSourceStatus;
  run?: () => Promise<void>;
}> {
  if (!process.env.AMZ_API_KEY || !process.env.AMZ_API_SECRET) {
    return { status: "skipped" };
  }
  await prisma.syncState.upsert({
    where: { key: STATE_KEY },
    create: { key: STATE_KEY, phase: "q:0", page: 1 },
    update: {},
  });
  const st = await prisma.syncState.findUnique({ where: { key: STATE_KEY } });
  if (!st || busyFresh(st.busyAt) || !(await acquireLock(STATE_KEY))) {
    return { status: "busy" };
  }
  return { status: "started", run: () => runAmazonLocked() };
}
