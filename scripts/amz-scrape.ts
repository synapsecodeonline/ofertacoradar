// Scrape de catalogo Amazon Brasil a partir de paginas publicas
// (best-sellers, deals, categorias). Roda LOCALMENTE — a Amazon
// bloqueia IP de datacenter (Vercel), entao NAO funciona la.
//
// Uso:  npx tsx --env-file=.env scripts/amz-scrape.ts [opcoes]
//   --pages N     limite de paginas (default: todas da lista)
//   --delay MS    pausa entre requests (default: 4000)
//   --only TRECHO filtra URLs que contenham o trecho (ex: deals)
//   --dry         so lista o que encontrou, nao grava no banco
//   --max-new N   maximo de produtos NOVOS gravados nesta execucao
//                 (existentes so atualizam). Ao atingir, para de buscar
//                 paginas — menos requests = menos risco de bloqueio.
//
// Se a Amazon mudar o HTML, o parser avisa "0 produtos numa pagina
// que deveria ter" — ajuste os regex de extract() abaixo.
import { prisma } from "../src/lib/db";
import { addAmazonProduct } from "../src/lib/amazon";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Paginas fonte: deals e nichos quentes primeiro — com --max-new a cota
// enche pelas primeiras URLs, entao o que tem mais desconto/nicho vem antes.
// Buscas /s?k= usam o mesmo data-asin dos cards.
const SOURCES = [
  "https://www.amazon.com.br/deals",
  "https://www.amazon.com.br/gp/bestsellers/baby",
  "https://www.amazon.com.br/s?k=mamadeira",
  "https://www.amazon.com.br/gp/bestsellers",
  "https://www.amazon.com.br/gp/bestsellers/electronics",
  "https://www.amazon.com.br/gp/bestsellers/kitchen",
  "https://www.amazon.com.br/gp/bestsellers/beauty",
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const MAX_PAGES = Number(arg("pages") ?? SOURCES.length);
const DELAY = Number(arg("delay") ?? 5000);
const ONLY = arg("only")?.toLowerCase();
const DRY = process.argv.includes("--dry");
const MAX_NEW = Number(arg("max-new") ?? Infinity);

type Found = {
  asin: string;
  title: string;
  price: number | null;
  oldPrice: number | null;
  imageUrl: string | null;
};

const brl = (s: string) =>
  Number(s.replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", ".")) || null;

// Quebra o HTML em blocos por data-asin e extrai os campos de cada card.
// ASIN Amazon BR: B0 + 8 chars (ex: B0CX8MT2M2)
function extract(html: string): Found[] {
  const out: Found[] = [];
  const re = /data-asin="(B0[A-Z0-9]{8})"/g;
  let m: RegExpExecArray | null;
  // data-asin repete dentro do mesmo card — agrupa ocorrencias
  // consecutivas do MESMO asin; o bloco vai ate o proximo asin diferente
  const marks: { asin: string; at: number }[] = [];
  while ((m = re.exec(html))) {
    if (marks[marks.length - 1]?.asin !== m[1]) {
      marks.push({ asin: m[1], at: m.index });
    }
  }

  const decode = (s: string) =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();

  for (let i = 0; i < marks.length; i++) {
    const chunk = html.slice(marks[i].at, marks[i + 1]?.at ?? marks[i].at + 60000);
    if (chunk.length < 1500) continue; // bloco cortado/rabo de pagina

    // Titulo: best-sellers usa p13n-sc-truncate; outras paginas usam
    // a-size-base-plus, headings ou o alt da imagem do produto
    let title =
      chunk.match(/p13n-sc-truncate[^>]*>([^<]{10,300})</)?.[1] ??
      chunk.match(/a-size-base-plus[^>]*>([^<]{10,300})</)?.[1] ??
      chunk.match(/<h[23][^>]*>[\s\S]{0,500}?>([^<]{10,300})</)?.[1] ??
      chunk.match(/alt="([^"]{15,300})"/)?.[1] ??
      "";
    title = decode(title).replace(/\s*\|\s*$/, "");
    if (!title || /^(patrocinado|ver mais|oferta|pular)/i.test(title)) continue;

    // Preco atual: primeiro "R$ 1.234,56" visivel no bloco do card.
    // Instalments tipo "12x de R$ X" vem DEPOIS do preco cheio, entao
    // o primeiro match e o preco do produto.
    const priceM = chunk.match(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/);
    const price = priceM ? brl(priceM[1]) : null;

    // Preco antigo so com marcador explicito de "de/riscar" —
    // best-sellers nao mostra, paginas de deal sim
    let oldPrice: number | null = null;
    const oldM =
      chunk.match(/a-text-price[\s\S]{0,200}?R\$\s*([\d.,]+)/) ??
      chunk.match(/list-price[\s\S]{0,200}?R\$\s*([\d.,]+)/) ??
      chunk.match(/De:<\/span>[\s\S]{0,120}?R\$\s*([\d.,]+)/);
    if (oldM) {
      const v = brl(oldM[1]);
      if (v && price && v > price) oldPrice = v;
    }

    // Imagem: ssl-images (best-sellers) ou media-amazon (busca/deals).
    // Pega a primeira URL de /images/I/ que seja imagem de produto
    // (ignora assets .css/.js que a Amazon embute na pagina) e amplia
    // o thumbnail para 640px.
    const imgCandidates = [
      ...chunk.matchAll(
        /https:\/\/(?:images-na\.ssl-images-amazon\.com|m\.media-amazon\.com)\/images\/I\/[^"'\s]+/g,
      ),
    ].map((x) => x[0]);
    let imageUrl =
      imgCandidates.find((u) => /\.(jpg|jpeg|png|webp)(\?|&|$)/i.test(u) || /\._AC_/.test(u)) ??
      null;
    if (imageUrl) {
      imageUrl = imageUrl.replace(/\._AC_[A-Z0-9_,]*\.(jpg|png)/, "._AC_UL640_.$1");
      imageUrl = imageUrl.replace(/&amp;/g, "&");
    }

    // Regra: produto precisa de titulo + imagem + preco pra entrar
    if (title && imageUrl && price) {
      out.push({ asin: marks[i].asin, title, price, oldPrice, imageUrl });
    }
  }
  return out;
}

async function fetchPage(
  url: string,
): Promise<{ html: string | null; blocked?: boolean }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "pt-BR,pt;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    console.log(`  HTTP ${res.status} em ${url}`);
    return { html: null };
  }
  const html = await res.text();
  // Pagina de captcha/bloqueio da Amazon e minuscula (~4KB) vs ~700KB
  // de uma pagina de catalogo normal.
  if (html.length < 50_000) {
    console.log(
      "  🚫 Amazon devolveu pagina de bloqueio/captcha — IP temporariamente\n" +
        "     limitado. Aguarde alguns minutos antes de rodar de novo.",
    );
    return { html: null, blocked: true };
  }
  return { html };
}

async function main() {
  const urls = SOURCES.filter((u) => !ONLY || u.includes(ONLY)).slice(0, MAX_PAGES);
  console.log(`${urls.length} pagina(s) para raspar.\n`);

  const seen = new Set<string>();
  // ASINs ja cadastrados: externalId -> oldPrice. A listagem nao mostra
  // "De: R$ X", entao o oldPrice gravado pelo verify e preservado no update
  // (senao cada scrape apagaria o desconto).
  const existing = new Map(
    (
      await prisma.product.findMany({
        where: { externalId: { startsWith: "amz:" } },
        select: { externalId: true, oldPrice: true },
      })
    ).map((p) => [p.externalId!, p.oldPrice] as const),
  );
  // blocklist do verify: {asin: expiresAt} — 0 = permanente (inelegivel),
  // futuro = temporario (sem desconto; expira e pode voltar com oferta)
  const blockedFile = join(
    homedir(),
    ".config/ofertacoradar/amz-blocked.json",
  );
  const blockedMap: Record<string, number> = existsSync(blockedFile)
    ? JSON.parse(readFileSync(blockedFile, "utf8"))
    : {};
  const isBlocked = (ext: string) => {
    const t = blockedMap[ext];
    return t === 0 || (t != null && t > Date.now());
  };
  let total = 0, inserted = 0, updated = 0, skipped = 0, errors = 0, newCount = 0, quotaHit = false;

  for (const url of urls) {
    if (quotaHit) break;
    console.log(`→ ${url}`);
    const { html, blocked } = await fetchPage(url);
    if (!html) {
      errors++;
      if (blocked) break; // IP bloqueado — proximas paginas vao falhar igual
      await sleep(DELAY);
      continue;
    }
    const items = extract(html);
    // Detector de mudanca de layout: pagina valida sem nenhum ASIN
    if (items.length === 0) {
      console.log(
        "  ⚠️  0 produtos extraidos — a Amazon pode ter mudado o layout.\n" +
          "     Se persistir, me avise que eu ajusto o parser (extract()).",
      );
    } else {
      console.log(`  ${items.length} produtos encontrados`);
    }

    for (const p of items) {
      if (seen.has(p.asin)) {
        skipped++;
        continue;
      }
      seen.add(p.asin);
      total++;
      if (isBlocked(`amz:${p.asin}`)) {
        skipped++;
        continue; // rejeitado pelo verify (inelegivel ou sem desconto)
      }
      const isNew = !existing.has(`amz:${p.asin}`);
      const prevOld = existing.get(`amz:${p.asin}`);
      if (isNew && newCount >= MAX_NEW) {
        quotaHit = true;
        break; // cota de novos cheia — para de gravar E de buscar paginas
      }
      if (DRY) {
        console.log(`   [dry] ${p.asin} | ${p.title.slice(0, 60)} | R$ ${p.price}`);
        continue;
      }
      // Sem imagem nao cadastra: produto sem foto nao aparece no site
      if (!p.imageUrl || !p.price) {
        skipped++;
        continue;
      }
      try {
        await addAmazonProduct({
          asin: p.asin,
          title: p.title,
          price: p.price,
          // listagem nao tem "De: R$" — preserva o oldPrice que o verify gravou
          oldPrice: p.oldPrice ?? prevOld ?? null,
          imageUrl: p.imageUrl,
        });
        if (isNew) newCount++;
        else updated++;
        inserted++;
      } catch (e) {
        console.log(`   erro ${p.asin}: ${e instanceof Error ? e.message : e}`);
      }
      await sleep(150); // respiro entre inserts
    }
    if (quotaHit) {
      console.log(`  cota de ${MAX_NEW} produtos novos atingida — parando.`);
      break;
    }
    await sleep(DELAY);
  }

  const ativos = await prisma.product.count({
    where: { active: true, externalId: { startsWith: "amz:" } },
  });
  console.log(
    `\nPronto: ${total} unicos | ${inserted} gravados (${newCount} novos, ${updated} atualizados) | ${skipped} pulados | ${errors} paginas com erro.\n` +
      `Amazon ativos no site: ${ativos}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
