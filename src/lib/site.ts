// URL canonica do site. Defina NEXT_PUBLIC_SITE_URL em producao.
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export const SITE_NAME = "Ofertaço Radar";
export const SITE_TAGLINE = "Cupons e ofertas com desconto";
