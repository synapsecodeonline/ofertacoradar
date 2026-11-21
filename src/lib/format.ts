export function formatPrice(value: number | null | undefined, currency = "BRL") {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function discountPercent(price?: number | null, oldPrice?: number | null) {
  if (!price || !oldPrice || oldPrice <= price) return null;
  return Math.round((1 - price / oldPrice) * 100);
}

export function discountPctOf(p: { price?: number | null; oldPrice?: number | null }) {
  return discountPercent(p.price, p.oldPrice);
}

// URLs de imagem de alguns feeds (ex: VTEX/Moto BR) vem com espacos
// crus no nome do arquivo — o browser nem sempre encoda e a imagem quebra.
export function imgSrc(u: string | null | undefined): string | undefined {
  return u ? u.trim().replace(/ /g, "%20") : undefined;
}

// Decodifica entidades HTML em títulos/descrições vindas de feeds
// ("Roup&#xE3;o" -> "Roupão"). Sem isso a palavra nunca casa nos
// classificadores e o produto cai em "outros" — e o site exibe
// a entidade crua pro usuario.
export function decodeEntities(s: string): string {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
    acirc: "â", ecirc: "ê", icirc: "î", ocirc: "ô", ucirc: "û",
    atilde: "ã", otilde: "õ", agute: "á", egrave: "è", agrave: "à",
    ccedil: "ç", ntilde: "ñ", uuml: "ü", deg: "°", ordm: "º", ordf: "ª",
    reg: "®", copy: "©", trade: "™", hellip: "…", mdash: "—", ndash: "–",
    lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•", middot: "·",
  };
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      const cp = parseInt(h, 16);
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    })
    .replace(/&#(\d+);/g, (_, d) => {
      const cp = parseInt(d, 10);
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
    })
    .replace(/&([a-zA-Z]+);/g, (m, e) => named[e] ?? m);
}
