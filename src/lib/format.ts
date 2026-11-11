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
