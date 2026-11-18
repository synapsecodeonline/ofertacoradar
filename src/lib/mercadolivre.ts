import { prisma } from "./db";
import type { NormalizedProduct } from "./feed";

// ---- Mercado Livre (api.mercadolibre.com) ----
// Auth: OAuth2. Tokens ficam no SyncState (key "ml-token", phase = JSON)
// porque env vars nao podem ser reescritas em serverless e o role do app
// nao tem DDL para criar tabela propria.
// Bootstrap via web: /api/ml-auth/start -> /api/ml-auth/callback.
//
// NOTA: /sites/{site}/search foi descontinuado pelo ML (403 para todos os
// apps). A busca usa a API de catalogo:
//   /products/search?q=...  -> produtos de catalogo
//   /products/{id}/items    -> vencedor da buy box (preco real)
//   /items?ids=...          -> permalink/foto/preco oficial (multiget)

const API = "https://api.mercadolibre.com";
export const ML_SITE = "MLB";
export const ML_LIMIT = 30;

// Queries amplas para cobrir o catalogo. Cada query e paginada pelo
// syncer (phase "q:{i}", page=offset).
export const ML_QUERIES = [
  "notebook", "notebook gamer", "smartphone", "fone de ouvido bluetooth",
  "smart tv", "monitor", "ssd", "memória ram", "mouse gamer",
  "teclado mecânico", "console", "playstation", "xbox", "nintendo switch",
  "tablet", "kindle", "câmera", "drone", "smartwatch", "caixa de som",
  "airfryer", "aspirador de pó", "robo aspirador", "cafeteira",
  "panela de pressão elétrica", "liquidificador", "batedeira",
  "micro-ondas", "forno elétrico", "geladeira", "fogão", "lavadora de roupas",
  "ar condicionado", "ventilador", "umidificador",
  "perfume", "maquiagem", "skincare", "shampoo", "creme hidratante",
  "tênis", "mochila", "jaqueta", "oculos de sol", "camisa de time",
  "brinquedo", "jogo de tabuleiro", "pet", "ração para cachorro",
  "suplemento", "whey protein", "halteres", "bicicleta", "esteira",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Token OAuth ----

const TOKEN_STATE_KEY = "ml-token";

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO
}

async function readTokens(): Promise<StoredTokens | null> {
  const row = await prisma.syncState
    .findUnique({ where: { key: TOKEN_STATE_KEY } })
    .catch(() => null);
  if (!row?.phase) return null;
  try {
    return JSON.parse(row.phase) as StoredTokens;
  } catch {
    return null;
  }
}

export async function saveMlTokens(
  accessToken: string,
  refreshToken: string,
  expiresInSeconds: number,
) {
  const payload: StoredTokens = {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  };
  await prisma.syncState.upsert({
    where: { key: TOKEN_STATE_KEY },
    create: { key: TOKEN_STATE_KEY, phase: JSON.stringify(payload) },
    update: { phase: JSON.stringify(payload) },
  });
}

let cachedToken: { token: string; expiresAt: number } | null = null;
const SKEW_MS = 60_000;

async function refreshAccessToken(): Promise<string | null> {
  const row = await readTokens();
  if (!row) return null;

  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ML_CLIENT_ID!,
      client_secret: process.env.ML_CLIENT_SECRET!,
      refresh_token: row.refreshToken,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(
      `[mercadolivre] refresh falhou (${res.status}):`,
      await res.text().catch(() => ""),
    );
    return null;
  }
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) return null;

  const expiresIn = json.expires_in ?? 21600;
  await saveMlTokens(
    json.access_token,
    json.refresh_token ?? row.refreshToken,
    expiresIn,
  );
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return json.access_token;
}

export async function getMlAccessToken(
  forceRefresh = false,
): Promise<string | null> {
  if (!process.env.ML_CLIENT_ID || !process.env.ML_CLIENT_SECRET) return null;

  if (
    !forceRefresh &&
    cachedToken &&
    cachedToken.expiresAt - SKEW_MS > Date.now()
  ) {
    return cachedToken.token;
  }

  const row = await readTokens();
  if (
    row &&
    !forceRefresh &&
    new Date(row.expiresAt).getTime() - SKEW_MS > Date.now()
  ) {
    cachedToken = {
      token: row.accessToken,
      expiresAt: new Date(row.expiresAt).getTime(),
    };
    return row.accessToken;
  }
  return refreshAccessToken();
}

// ---- Busca (API de catalogo) ----

interface MlCatalogProduct {
  id?: string;
  name?: string;
  domain_id?: string;
  pictures?: { url?: string }[];
}

async function mlGet<T>(path: string, token: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function mapPool<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = await Promise.all(items.slice(i, i + size).map(fn));
    for (const r of chunk) if (r !== null) out.push(r);
  }
  return out;
}

interface MlSearchResult {
  id?: string;
  title?: string;
  price?: number;
  original_price?: number;
  thumbnail?: string;
  secure_thumbnail?: string;
  permalink?: string;
  category_id?: string;
}

function normalizeResult(r: MlSearchResult): NormalizedProduct | null {
  if (!r.id || !r.title) return null;
  const price = typeof r.price === "number" ? r.price : undefined;
  if (!price || price <= 0) return null;

  return {
    externalId: `ml:${r.id}`,
    title: r.title,
    imageUrl: r.secure_thumbnail ?? r.thumbnail,
    price,
    oldPrice:
      typeof r.original_price === "number" && r.original_price > price
        ? r.original_price
        : undefined,
    merchant: "Mercado Livre",
    url: r.permalink ?? `https://www.mercadolivre.com.br/p/${r.id}`,
  };
}

export async function fetchMercadoLivrePage(
  query: string,
  offset: number,
): Promise<{ items: NormalizedProduct[]; total: number } | null> {
  let token = await getMlAccessToken();
  if (!token) return null;

  const qs = new URLSearchParams({
    site_id: ML_SITE,
    status: "active",
    q: query,
    limit: String(ML_LIMIT),
    offset: String(offset),
  });
  let search = await mlGet<{
    results?: MlCatalogProduct[];
    paging?: { total?: number };
  }>(`/products/search?${qs}`, token);
  if (search === null) {
    // token expirado/invalido: forca refresh e tenta de novo
    token = await getMlAccessToken(true);
    if (!token) return null;
    search = await mlGet(`/products/search?${qs}`, token);
    if (search === null) {
      throw new Error(`ML products/search "${query}" falhou`);
    }
  }

  const products = search.results ?? [];
  if (products.length === 0) {
    return { items: [], total: search.paging?.total ?? 0 };
  }

  // 1) vencedor da buy box por produto de catalogo (preco real)
  const winners = await mapPool(products, 10, async (p) => {
    if (!p.id) return null;
    const itemsRes = await mlGet<{
      results?: {
        item_id?: string;
        price?: number;
        original_price?: number | null;
      }[];
    }>(`/products/${p.id}/items?limit=1`, token!);
    const w = itemsRes?.results?.[0];
    return w?.item_id && typeof w.price === "number"
      ? {
          catalogId: p.id,
          itemId: w.item_id,
          price: w.price,
          originalPrice:
            typeof w.original_price === "number" ? w.original_price : undefined,
        }
      : null;
  });
  if (winners.length === 0) {
    return { items: [], total: search.paging?.total ?? 0 };
  }

  // 2) o endpoint /items/{id} e /items?ids= sao restritos a itens do
  // proprio usuario (403 access_denied). Montamos a URL do anuncio vencedor
  // pelo formato curto oficial produto.mercadolivre.com.br/MLB-{id} e usamos
  // a foto do produto de catalogo + preco do vencedor.
  const byCatalogId = new Map(products.map((p) => [p.id, p]));
  const items: NormalizedProduct[] = [];
  for (const w of winners) {
    const cat = byCatalogId.get(w.catalogId);
    if (!cat?.name) continue;

    const itemId = w.itemId.replace(/^MLB-?/, "");
    const n = normalizeResult({
      id: w.catalogId,
      title: cat.name,
      price: w.price,
      original_price: w.originalPrice,
      thumbnail: cat.pictures?.[0]?.url,
      permalink: `https://produto.mercadolivre.com.br/MLB-${itemId}`,
    });
    if (n) items.push(n);
  }

  return { items, total: search.paging?.total ?? products.length };
}

// ---- Sync completo (uso manual via scripts/sync.ts) ----

export async function fetchMercadoLivreAll(
  maxPagesPerQuery = 4,
): Promise<NormalizedProduct[]> {
  if (!process.env.ML_CLIENT_ID || !process.env.ML_CLIENT_SECRET) return [];
  const out: NormalizedProduct[] = [];
  for (const q of ML_QUERIES) {
    for (let page = 0; page < maxPagesPerQuery; page++) {
      const res = await fetchMercadoLivrePage(q, page * ML_LIMIT);
      if (!res) return out;
      out.push(...res.items);
      if (
        res.items.length < ML_LIMIT ||
        (page + 1) * ML_LIMIT >= res.total
      ) {
        break;
      }
      await sleep(400);
    }
    await sleep(400);
  }
  return out;
}
