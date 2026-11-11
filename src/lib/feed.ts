import { XMLParser } from "fast-xml-parser";

export interface NormalizedProduct {
  externalId?: string;
  organizationId?: string;
  title: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  oldPrice?: number;
  category?: string;
  merchant?: string;
  url: string;
  affiliateUrl?: string;
  couponCode?: string;
  endsAt?: Date;
}

type Obj = Record<string, unknown>;

function asObj(v: unknown): Obj | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined;
}

function first(obj: Obj, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function asArray(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function toNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function toStr(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "object") {
    const o = asObj(v);
    if (o) return toStr(first(o, ["__text", "#text", "value", "url", "href"]));
    return undefined;
  }
  const s = String(v).trim();
  return s || undefined;
}

function pickUrl(v: unknown): string | undefined {
  if (typeof v === "string") return v || undefined;
  const o = asObj(v);
  if (!o) return undefined;
  return toStr(first(o, ["__text", "#text", "url", "href", "value"]));
}

function extractItems(parsed: unknown): unknown[] {
  const root = asObj(parsed);
  if (!root) return [];
  const rss = asObj(root.rss);
  const channel = rss ? asObj(rss.channel) : asObj(root.channel);
  const container = channel ?? root;

  const candidates = ["item", "product", "products", "offer", "offers", "ad", "ads", "record"];
  for (const key of candidates) {
    const items = asArray(container[key] ?? root[key]);
    if (items.length > 0) return items;
  }
  // Fallback: root itself may be a single product or an array at top level
  return [];
}

function normalizeItem(raw: unknown): NormalizedProduct | null {
  let item = asObj(raw);
  if (!item) return null;

  // Desembrulha wrappers comuns: <product><offer>...</offer></product>
  const inner = asObj(item.offer) ?? asObj(item.product) ?? asObj(item.item);
  if (inner && first(inner, ["title", "name", "nome"])) item = { ...item, ...inner };

  const url = pickUrl(first(item, ["affiliateUrl", "deeplink", "deepLink", "trackingUrl"]))
    ?? pickUrl(first(item, ["url", "link", "productUrl", "produto_url", "landingPage"]));
  if (!url) return null;

  const affiliateUrl = pickUrl(first(item, ["affiliateUrl", "deeplink", "deepLink", "trackingUrl"]));
  const directUrl = pickUrl(first(item, ["url", "link", "productUrl", "produto_url", "landingPage"]));

  const image = first(item, ["imageUrl", "image", "imagem", "picture", "foto", "thumbnail"]);
  const category = toStr(first(item, ["category", "categoria", "department", "departamento"]));
  const merchant = toStr(first(item, ["merchant", "loja", "seller", "anunciante", "brand", "marca"]));
  const externalId = toStr(first(item, ["id", "sku", "externalId", "codigo", "code"]));

  return {
    externalId,
    title: toStr(first(item, ["title", "name", "nome", "productName"])) ?? "Sem título",
    description: toStr(first(item, ["description", "descricao", "desc", "summary", "resumo"])),
    imageUrl: pickUrl(image) ?? toStr(image),
    price: toNumber(first(item, ["price", "preco", "preco_atual", "salePrice", "current_price", "valor"])),
    oldPrice: toNumber(first(item, ["oldPrice", "preco_antigo", "listPrice", "original_price", "preco_de", "de"])),
    category,
    merchant,
    url: directUrl ?? url,
    affiliateUrl: affiliateUrl ?? url,
    couponCode: toStr(first(item, ["coupon", "cupom", "couponCode", "codigo", "code"])),
  };
}

// ---- Lomadee Affiliate API ----

// A API da Lomadee retorna preços ja em reais (ex.: 24.99)
function toPrice(v: unknown): number | undefined {
  return toNumber(v);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function labelOf(v: unknown): string | undefined {
  if (typeof v === "string") return v || undefined;
  const o = asObj(v);
  if (!o) return undefined;
  return toStr(first(o, ["name", "title", "label", "value", "description"]));
}

export interface LomadeeProduct {
  organizationId?: string;
  id?: string;
  name?: string;
  description?: string;
  url?: string;
  images?: { url?: string }[];
  categories?: unknown[];
  brands?: unknown[];
  options?: {
    pricing?: { listPrice?: number; price?: number }[];
    images?: { url?: string }[];
  }[];
}

export function normalizeLomadeeProduct(p: LomadeeProduct): NormalizedProduct | null {
  if (!p.url || !p.name) return null;
  const option = p.options?.[0];
  const pricing = option?.pricing?.[0];
  const imageUrl = p.images?.[0]?.url ?? option?.images?.[0]?.url;

  return {
    externalId: p.organizationId && p.id ? `${p.organizationId}:${p.id}` : p.id,
    organizationId: p.organizationId,
    title: p.name,
    description: p.description ? stripHtml(p.description) : undefined,
    imageUrl,
    price: toPrice(pricing?.price),
    oldPrice: toPrice(pricing?.listPrice),
    category: p.categories?.map(labelOf).find(Boolean),
    merchant: p.brands?.map(labelOf).find(Boolean),
    url: p.url,
    affiliateUrl: p.url,
  };
}

export async function fetchLomadeeProducts(
  apiKey: string,
  baseUrl = "https://api.lomadee.com.br",
  maxProducts = 5000,
): Promise<NormalizedProduct[]> {
  const products: NormalizedProduct[] = [];
  let page = 1;
  const limit = 100;

  while (products.length < maxProducts) {
    const res = await fetch(
      `${baseUrl}/affiliate/products?page=${page}&limit=${limit}&isAvailable=true`,
      { headers: { "x-api-key": apiKey }, cache: "no-store" },
    );
    if (!res.ok) {
      throw new Error(`Lomadee API respondeu ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { data?: LomadeeProduct[]; count?: number };
    const items = json.data ?? [];
    for (const item of items) {
      const p = normalizeLomadeeProduct(item);
      if (p) products.push(p);
    }
    if (items.length < limit) break;
    page++;
    if (page > 100) break; // seguranca
  }

  return products;
}

// ---- Lomadee campaigns (ofertas/cupons com link rastreado) ----

export interface LomadeeBrand {
  id: string;
  name: string;
  logo?: string;
  site?: string;
}

interface LomadeeChannel {
  shortUrls?: string[];
}

async function lomadeeGet<T>(
  apiKey: string,
  baseUrl: string,
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  );

  // A API da Lomadee retorna 500 intermitente e limita a 60 req/min;
  // tenta de novo com backoff e respeita Retry-After no 429
  let lastError = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${baseUrl}${path}?${qs}`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (res.ok) return res.json() as Promise<T>;
    lastError = `Lomadee API ${path} respondeu ${res.status}: ${await res.text()}`;
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get("retry-after")) || 0;
      const wait = Math.max(retryAfter * 1000, 1000 * (attempt + 1));
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(lastError);
  }
  throw new Error(lastError);
}

export async function fetchLomadeeBrandsPage(
  apiKey: string,
  baseUrl: string,
  page: number,
): Promise<{ items: LomadeeBrand[]; totalPages: number }> {
  const json = await lomadeeGet<{
    data?: { id: string; name: string; logo?: string; site?: string }[];
    meta?: { totalPages?: number };
    pagination?: { totalPages?: number };
  }>(apiKey, baseUrl, "/affiliate/brands", { page, limit: 20 });
  return {
    items: (json.data ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      logo: b.logo,
      site: b.site,
    })),
    totalPages: json.pagination?.totalPages ?? json.meta?.totalPages ?? page,
  };
}

export async function fetchLomadeeBrands(
  apiKey: string,
  baseUrl = "https://api.lomadee.com.br",
): Promise<Map<string, LomadeeBrand>> {
  const map = new Map<string, LomadeeBrand>();
  let page = 1;
  for (;;) {
    const { items, totalPages } = await fetchLomadeeBrandsPage(
      apiKey,
      baseUrl,
      page,
    );
    for (const b of items) map.set(b.id, b);
    if (page >= totalPages) break;
    page++;
    await new Promise((r) => setTimeout(r, 300)); // rate limit: 60 req/min
  }
  return map;
}

export interface AffiliatedOrgInfo {
  organizationId: string;
  name?: string;
}

export interface LomadeeCampaign {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  url?: string;
  code?: string;
  description?: string;
  categories?: string[];
  organizationId?: string;
  channels?: LomadeeChannel[];
  mediaKit?: { banners?: string[] | null; emailMarketing?: unknown } | null;
  period?: { startAt?: string; endAt?: string } | null;
}

// Normaliza uma campanha em oferta; retorna null se nao for exibivel
export function normalizeLomadeeCampaign(
  c: LomadeeCampaign,
  brand?: LomadeeBrand,
): { product: NormalizedProduct; org?: AffiliatedOrgInfo } | null {
  if (c.status !== "onTime") return null;
  const shortUrl = c.channels?.flatMap((ch) => ch.shortUrls ?? [])[0];
  if (!shortUrl) return null;

  return {
    product: {
      externalId: `camp:${c.id}`,
      title: c.name ?? "Oferta",
      description:
        [c.description, c.code ? `Cupom: ${c.code}` : null]
          .filter(Boolean)
          .join("\n\n") || undefined,
      imageUrl: c.mediaKit?.banners?.[0] ?? brand?.logo,
      category: c.categories?.[0],
      merchant: brand?.name,
      url: shortUrl,
      affiliateUrl: shortUrl,
      couponCode: c.code,
      endsAt: c.period?.endAt ? new Date(c.period.endAt) : undefined,
    },
    org: c.organizationId
      ? { organizationId: c.organizationId, name: brand?.name }
      : undefined,
  };
}

export async function fetchLomadeeCampaignsPage(
  apiKey: string,
  baseUrl: string,
  page: number,
): Promise<{ items: LomadeeCampaign[]; totalPages: number }> {
  const json = await lomadeeGet<{
    data?: LomadeeCampaign[];
    meta?: { totalPages?: number };
  }>(apiKey, baseUrl, "/affiliate/campaigns", { page, limit: 20 });
  return {
    items: json.data ?? [],
    totalPages: json.meta?.totalPages ?? page,
  };
}

export async function fetchLomadeeCampaigns(
  apiKey: string,
  baseUrl = "https://api.lomadee.com.br",
  brands?: Map<string, LomadeeBrand>,
): Promise<{ items: NormalizedProduct[]; orgs: AffiliatedOrgInfo[] }> {
  const products: NormalizedProduct[] = [];
  const orgs = new Map<string, AffiliatedOrgInfo>();
  let page = 1;
  let totalPages = Infinity;
  let consecutiveFailures = 0;

  for (;;) {
    let result: { items: LomadeeCampaign[]; totalPages: number };
    try {
      result = await fetchLomadeeCampaignsPage(apiKey, baseUrl, page);
    } catch {
      // Paginas especificas da API retornam 500 de forma consistente;
      // pula a pagina em vez de abortar o sync inteiro
      console.warn(`Pagina ${page} de campanhas falhou, pulando.`);
      page++;
      if (++consecutiveFailures > 30) break;
      continue;
    }
    consecutiveFailures = 0;
    totalPages = result.totalPages;

    for (const c of result.items) {
      const brand = c.organizationId ? brands?.get(c.organizationId) : undefined;
      const normalized = normalizeLomadeeCampaign(c, brand);
      if (!normalized) continue;
      products.push(normalized.product);
      if (normalized.org && !orgs.has(normalized.org.organizationId)) {
        orgs.set(normalized.org.organizationId, normalized.org);
      }
    }

    if (page >= totalPages) break;
    page++;
    await new Promise((r) => setTimeout(r, 300)); // rate limit: 60 req/min
  }

  return { items: products, orgs: [...orgs.values()] };
}

// Busca uma pagina do catalogo de produtos (para exibicao ao vivo no site)
export async function fetchLomadeeProductsPage(
  apiKey: string,
  baseUrl = "https://api.lomadee.com.br",
  page = 1,
  limit = 48,
): Promise<{ items: NormalizedProduct[]; count: number }> {
  const json = await lomadeeGet<{
    data?: LomadeeProduct[];
    count?: number;
  }>(apiKey, baseUrl, "/affiliate/products", {
    page,
    limit,
    isAvailable: "true",
  });
  const items = (json.data ?? [])
    .map(normalizeLomadeeProduct)
    .filter((p): p is NormalizedProduct => p !== null);
  return { items, count: json.count ?? items.length };
}

export async function fetchFeed(url: string): Promise<NormalizedProduct[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Feed respondeu ${res.status} ${res.statusText}`);
  const text = await res.text();

  let parsed: unknown;
  const trimmed = text.trim();
  if (trimmed.startsWith("<")) {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      parseTagValue: true,
      trimValues: true,
    });
    parsed = parser.parse(text);
  } else {
    parsed = JSON.parse(text);
  }

  const items = extractItems(parsed);
  return items.map(normalizeItem).filter((p): p is NormalizedProduct => p !== null);
}
