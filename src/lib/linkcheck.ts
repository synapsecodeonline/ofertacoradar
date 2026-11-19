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
  /p[áa]gina n[ãa]o encontrada/i,
  /produto n[ãa]o encontrado/i,
  /item n[ãa]o encontrado/i,
  /p[áa]gina inexistente/i,
  /p[áa]gina n[ãa]o existe/i,
  /p[áa]gina 404/i,
  /erro 404/i,
  /page not found/i,
  /product not found/i,
  /n[ãa]o encontramos/i,
  /link n[ãa]o (encontrado|dispon[íi]vel|inv[áa]lido)/i,
  /\boops\b/i,
  /p[áa]gina indispon[íi]vel/i,
];

function headingText(html: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((m) => m[1])
    .join(" ");
  return `${title} ${h1s}`.replace(/<[^>]+>/g, " ");
}

async function readPrefix(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  let received = 0;
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
      received += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return out;
}

export async function checkUrl(rawUrl: string): Promise<LinkStatus> {
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

  const html = await readPrefix(res, MAX_BODY_BYTES);
  if (!html) return "ok";

  const heading = headingText(html);
  if (DEAD_HEADING.some((re) => re.test(heading))) return "dead";
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
}): Promise<LinkStatus> {
  return checkUrl(linkTargetOf(p));
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
