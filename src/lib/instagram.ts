import { formatPrice } from "./format";

type CaptionProduct = {
  title: string;
  price: number | null;
  oldPrice: number | null;
  currency: string;
  merchant: string | null;
  couponCode: string | null;
  discountPct: number | null;
  category: string | null;
};

function tag(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function instagramCaption(p: CaptionProduct, url: string): string {
  const discount =
    p.discountPct ??
    (p.price != null && p.oldPrice != null && p.oldPrice > p.price
      ? Math.round((1 - p.price / p.oldPrice) * 100)
      : null);

  const lines: string[] = [];

  lines.push(
    discount !== null
      ? `🔥 ${discount}% OFF em ${p.title}!`
      : `🔥 Oferta imperdível: ${p.title}`,
  );
  lines.push("");

  const hasPrice = p.price != null;
  const hasOld =
    p.oldPrice != null && p.price != null && p.oldPrice > p.price;
  if (hasPrice) {
    const where = p.merchant ? ` na ${p.merchant}` : "";
    lines.push(
      hasOld
        ? `De ${formatPrice(p.oldPrice!, p.currency)} por apenas ${formatPrice(p.price!, p.currency)}${where}.`
        : `Por apenas ${formatPrice(p.price!, p.currency)}${where}.`,
    );
  } else if (p.merchant) {
    lines.push(`Disponível na ${p.merchant}.`);
  }

  if (p.couponCode) {
    lines.push("");
    lines.push(`🎟️ Cupom ${p.couponCode} — aplica no checkout e garante o desconto!`);
  }

  lines.push("");
  lines.push("⏰ Oferta por tempo limitado — corre que é por pouco tempo!");
  lines.push("");
  lines.push(`👉 Garanta a sua: ${url}`);
  lines.push(".");
  lines.push("");

  const tags = [
    "oferta",
    "promocao",
    "desconto",
    p.merchant ? tag(p.merchant) : null,
    p.category ? tag(p.category) : null,
    "economia",
    "achadinhos",
  ].filter((t): t is string => !!t && t.length > 1);

  lines.push([...new Set(tags)].map((t) => `#${t}`).join(" "));

  return lines.join("\n");
}
