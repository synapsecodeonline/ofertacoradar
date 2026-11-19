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
