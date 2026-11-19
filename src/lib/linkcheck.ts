import { syncPrisma as prisma } from "./db";
import { getMlAccessToken } from "./mercadolivre";
import { getTrackedUrl } from "./shortener";

// Validador de links de parceiros.
// Usa GET (nao HEAD — lojas respondem 200 no HEAD e 404 no GET) e le so o
// inicio do HTML para detectar paginas de "nao encontrado" que voltam 200.
//
// Retornos:
//   ok      -> pagina parece valida (produto, categoria ou home da loja)
//   dead    -> 404/410 ou titulo/h1 de "pagina/produto nao encontrado"
//   unknown -> antibot (403/429), timeout, erro de rede, verificacao ML
//              -> NUNCA desativa nesses casos (falso positivo caro)

export type LinkStatus = "ok" | "dead" | "unknown";

const TIMEOUT_MS = 12_000;
const MAX_BODY_BYTES = 96 * 1024;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Marcadores de pagina morta — conferidos so no <title> e <h1> para
// evitar falso positivo com "404" solto no corpo do HTML.
const DEAD_HEADING = [
  /p[áa]gina n[ãa]o (foi )?encontrada/i,
  /produto n[ãa]o (foi )?encontrado/i,
  /item n[ãa]o encontrado/i,
  /p[áa]gina inexistente/i,
  /p[áa]gina n[ãa]o existe/i,
  /p[áa]gina 404/i,
  /erro 404/i,
  /page not found/i,
  /product not found/i,
  /n[ãa]o (foi )?encontrad[ao]/i,
  /link n[ãa]o (encontrado|dispon[íi]vel|inv[áa]lido)/i,
  /\boops?\b/i,
  /p[áa]gina indispon[íi]vel/i,
];

// Frases de "nao encontrado" que aparecem no CORPO da pagina (nao so em
// title/h1). So padroes longos e inequivocos — "Ops!" sozinho nao serve
// porque lojas usam isso ate em widget de carrinho vazio.
const BODY_DEAD = [
  /p[áa]gina n[ãa]o (foi )?encontrada/i,
  /produto n[ãa]o (foi )?encontrado/i,
  /item n[ãa]o encontrado/i,
  /page not found/i,
  /product not found/i,
  /n[ãa]o foi encontrada/i,
];

// Soft-404: algumas lojas (Rovitex) redirecionam produto morto para uma
// pagina de categoria/busca com HTTP 200 e titulo normal. Para itens que
// deveriam ser pagina de produto, exigimos marcador de produto OU
// titulo final parecido com o titulo do produto.
const PRODUCT_MARKERS = [
  /"@type"\s*:\s*"Product"/i,
  /property="og:type"[^>]*content=["']product["']/i,
  /itemprop="price"/i,
  /"priceCurrency"/i,
  /"availability"\s*:\s*"https?:\/\//i,
];

function normWords(s: string): Set<string> {
  return new Set(
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

// Fracao das palavras do titulo do produto presentes no titulo/h1 final.
// Categoria generica ("Blusas e Camisetas") da ~0; pagina do produto da ~1.
function titleSimilarity(productTitle: string, heading: string): number {
  const want = normWords(productTitle);
  if (want.size === 0) return 1;
  const got = normWords(heading);
  let hit = 0;
  for (const w of want) if (got.has(w)) hit++;
  return hit / want.size;
}

function headingText(html: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((m) => m[1])
    .join(" ");
  return `${title} ${h1s}`.replace(/<[^>]+>/g, " ");
}

async function readPrefix(
  res: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: "", truncated: false };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  let received = 0;
  let done = false;
  try {
    while (received < maxBytes) {
      const { done: d, value } = await reader.read();
      if (d) {
        done = true;
        break;
      }
      out += decoder.decode(value, { stream: true });
      received += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return { text: out, truncated: !done };
}

export async function checkUrl(
  rawUrl: string,
  opts?: { expectProduct?: boolean; productTitle?: string },
): Promise<LinkStatus> {
  let url: string;
  try {
    url = new URL(rawUrl).toString();
  } catch {
    return "dead";
  }

  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "pt-BR,pt;q=0.9",
      },
    });
  } catch {
    return "unknown";
  }

  // Anti-bot / verificacao de conta (Mercado Livre redireciona p/ isso)
  if (/account-verification|verifica[cç][aã]o|captcha|robot/i.test(res.url)) {
    return "unknown";
  }
  if (res.status === 404 || res.status === 410) return "dead";
  if (res.status === 403 || res.status === 429 || res.status >= 500) {
    return "unknown";
  }
  if (!res.ok) return "unknown";

  const contentType = res.headers.get("content-type") ?? "";
  // Nao-HTML com 200 (imagem, pdf, etc.) esta vivo
  if (!/html|xml|text/i.test(contentType)) return "ok";

  const { text: html, truncated } = await readPrefix(res, MAX_BODY_BYTES);
  if (!html) return "ok";

  const heading = headingText(html);
  if (DEAD_HEADING.some((re) => re.test(heading))) return "dead";

  const hasProduct = PRODUCT_MARKERS.some((re) => re.test(html));

  // Soft-404: pagina final sem cara de produto e sem relacao com o titulo.
  // So avalia quando o HTML foi lido por completo — SPA pesada tipo
  // VTEX/Malwee trunca em 96KB sem <title> e nao da pra julgar (unknown).
  if (!hasProduct && !truncated) {
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    if (BODY_DEAD.some((re) => re.test(text))) return "dead";
  }
  if (opts?.expectProduct && opts.productTitle) {
    if (!heading.trim()) return "unknown";
    if (!hasProduct && titleSimilarity(opts.productTitle, heading) < 0.4) {
      return "dead";
    }
  }
  return "ok";
}

// URL que o usuario realmente visita ao clicar: affiliateUrl tem
// precedencia (lmdee.link ja vem com destino); senao vai a url direta.
export function linkTargetOf(p: {
  url: string;
  affiliateUrl: string | null;
}): string {
  return p.affiliateUrl ?? p.url;
}

// Prefixos validados: Lomadee (prod/camp), Awin e Mercado Livre.
// ml: e validado via API oficial do ML (nao por HTTP — o site tem
// anti-bot que tornaria qualquer scrape inconclusivo).
export const CHECKABLE_PREFIXES = [
  "prod-lomadee:",
  "camp-lomadee:",
  "aw:",
  "ml:",
] as const;

const ML_API = "https://api.mercadolibre.com";

// Valida produto de catalogo do ML pela API oficial:
// /products/{catalogId} existe e tem pelo menos 1 item ativo.
async function checkMlProduct(catalogId: string): Promise<LinkStatus> {
  const token = await getMlAccessToken();
  if (!token) return "unknown";
  try {
    const res = await fetch(`${ML_API}/products/${catalogId}/items?limit=1`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404 || res.status === 410) return "dead";
    if (!res.ok) return "unknown";
    const data = (await res.json()) as { results?: unknown[] };
    return (data.results?.length ?? 0) > 0 ? "ok" : "dead";
  } catch {
    return "unknown";
  }
}

// Imagem quebrada = produto nao esta "100% ok" -> desativa.
// So desativa em falha clara (404/410 ou HTML no lugar de imagem);
// timeout/403/CDN lenta = unknown, mantem.
async function imageDead(rawUrl: string): Promise<boolean> {
  const url = rawUrl.trim().replace(/ /g, "%20");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        headers: { "user-agent": UA },
        redirect: "follow",
      });
      // 404/410 e 400 (VTEX responde 400 JSON "Conta Inativa" para
      // imagem morta) = imagem quebrada de verdade. Confirmado 2x.
      if (res.status === 404 || res.status === 410 || res.status === 400) {
        if (attempt === 1) return true;
        await new Promise((r) => setTimeout(r, 1_500));
        continue;
      }
      // 403/429/CDN com rate-limit = ambiguo, NUNCA desativa
      if (!res.ok) return false;
      const ct = res.headers.get("content-type") ?? "";
      // 200 servindo HTML no lugar da imagem = quebrada de verdade
      if (/text\/html/.test(ct)) return attempt === 1;
      return false;
    } catch {
      return false;
    }
  }
  return false;
}

export async function validateProductLink(p: {
  url: string;
  affiliateUrl: string | null;
  title?: string | null;
  externalId?: string | null;
  organizationId?: string | null;
  imageUrl?: string | null;
}): Promise<LinkStatus> {
  const st = await checkProductLink(p);
  if (st !== "ok" || !p.imageUrl) return st;
  if (await imageDead(p.imageUrl)) return "dead";
  return st;
}

async function checkProductLink(p: {
  url: string;
  affiliateUrl: string | null;
  title?: string | null;
  externalId?: string | null;
  organizationId?: string | null;
}): Promise<LinkStatus> {
  // expectProduct so para catalogo de produtos (prod:/aw:). Ofertas
  // camp-lomadee: apontam para categoria/home por configuracao da rede.
  const expectProduct =
    !!p.externalId &&
    (p.externalId.startsWith("prod-lomadee:") || p.externalId.startsWith("aw:"));
  const opts = {
    expectProduct,
    productTitle: p.title ?? undefined,
  };
  // ml: vai pela API oficial do ML, nao por HTTP
  if (p.externalId?.startsWith("ml:")) {
    return checkMlProduct(p.externalId.slice(3));
  }
  // prod-lomadee: valida o lmdee.link REAL (o que o usuario clica).
  // O shortener adiciona utm_source/utm_medium/lmdeeTracking no destino
  // e algumas lojas (Rovitex) dao 404 com esses params — probe na URL
  // crua nao detecta isso.
  if (p.externalId?.startsWith("prod-lomadee:") && p.organizationId) {
    const tracked = await getTrackedUrl(p.url, p.organizationId);
    if (tracked) {
      const st = await checkUrl(tracked, opts);
      if (st === "dead") {
        await new Promise((r) => setTimeout(r, 1_500));
        return checkUrl(tracked, opts);
      }
      return st;
    }
    // sem shortener: cai no probe lmdeeTracking abaixo
  }
  const first = await checkUrl(linkTargetOf(p), opts);
  // Lojas instaveis (Rovitex) respondem 404 intermitente pro mesmo link —
  // so desativa se o "morto" se confirmar numa segunda tentativa.
  if (first === "dead") {
    await new Promise((r) => setTimeout(r, 1_500));
    return checkUrl(linkTargetOf(p), opts);
  }
  // Probe lmdeeTracking: o lmdee.link sempre adiciona ?lmdeeTracking= na
  // URL final. Todo produto exibido precisa passar com esse parametro —
  // se a loja da 404 com ele, o produto nao pode ficar no site.
  if (expectProduct && first === "ok" && p.url) {
    const probeUrl = withLmdeeTracking(p.url);
    if (probeUrl !== p.url) {
      const probe = await checkUrl(probeUrl, opts);
      if (probe === "dead") {
        await new Promise((r) => setTimeout(r, 1_500));
        const probe2 = await checkUrl(probeUrl, opts);
        if (probe2 === "dead") return "dead";
      }
    }
  }
  return first;
}

function withLmdeeTracking(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.searchParams.set("lmdeeTracking", "1");
    return u.toString();
  } catch {
    return rawUrl;
  }
}

// Processa uma lista com concorrencia limitada (educada com os sites).
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (idx < items.length) {
        const i = idx++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

export { prisma };
