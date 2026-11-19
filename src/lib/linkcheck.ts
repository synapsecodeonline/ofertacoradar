import { syncPrisma as prisma } from "./db";

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

// Prefixos validados: Lomadee (prod/camp) e Awin. ml: fica de fora —
// o anti-bot do ML torna qualquer checagem server-side inconclusiva.
export const CHECKABLE_PREFIXES = [
  "prod-lomadee:",
  "camp-lomadee:",
  "aw:",
] as const;

export async function validateProductLink(p: {
  url: string;
  affiliateUrl: string | null;
  title?: string | null;
  externalId?: string | null;
}): Promise<LinkStatus> {
  // expectProduct so para catalogo de produtos (prod:/aw:). Ofertas
  // camp-lomadee: apontam para categoria/home por configuracao da rede.
  const expectProduct =
    !!p.externalId &&
    (p.externalId.startsWith("prod-lomadee:") || p.externalId.startsWith("aw:"));
  return checkUrl(linkTargetOf(p), {
    expectProduct,
    productTitle: p.title ?? undefined,
  });
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
