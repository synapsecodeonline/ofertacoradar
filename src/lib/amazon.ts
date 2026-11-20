import { createHash, createHmac } from "node:crypto";
import { syncPrisma as prisma } from "./db";
import { discountPctOf } from "./format";
import { resolveCategory, resolveSubtype } from "./categories";
import {
  LOCK_STALE_MS,
  acquireLock,
  beat,
  busyFresh,
  clearError,
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

function amzUrl(asin: string) {
  return `https://www.amazon.com.br/dp/${asin}`;
}

async function upsertAmz(p: AmzItem) {
  const externalId = `amz:${p.asin}`;
  const url = amzUrl(p.asin);
  const affiliateUrl = `${url}?tag=${encodeURIComponent(PARTNER_TAG())}`;
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
    await prisma.product.updateMany({
      where: {
        active: true,
        externalId: { startsWith: "amz:" },
        NOT: { externalId: { in: [...seen].map((a) => `amz:${a}`) } },
      },
      data: { active: false },
    });
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
  if (!(await acquireLock(STATE_KEY))) return;

  await runAmazonLocked();
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
