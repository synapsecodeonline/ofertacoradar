import type { Metadata } from "next";
import { HomeExperience } from "@/components/HomeExperience";
import { siteUrl, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const dynamic = "force-dynamic";

const base = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Ofertas verificadas das lojas parceiras: produtos com desconto, cupons de desconto e promoções das melhores lojas, atualizadas diariamente.",
  keywords: [
    "ofertas do dia",
    "cupons de desconto",
    "promocoes",
    "ofertas mercadolivre",
    "ofertas online",
    "melhores ofertas",
    "comprar com desconto",
  ],
  alternates: { canonical: base },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      "Ofertas verificadas das lojas parceiras: produtos com desconto, cupons e promoções atualizadas diariamente.",
    url: base,
    images: [{ url: "/api/og", width: 1200, height: 630, alt: SITE_NAME }],
  },
};

// Dados estruturados para o Google: site + organizacao.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: SITE_NAME,
      alternateName: "Ofertaço Radar",
      url: base,
      description: SITE_TAGLINE,
      inLanguage: "pt-BR",
    },
    {
      "@type": "Organization",
      name: SITE_NAME,
      url: base,
      logo: `${base}/api/og`,
    },
  ],
};

// A home É o catálogo: abas por fonte (Lomadee, Mercado Livre, Awin),
// busca e filtros — tudo ranqueado por desconto.
export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeExperience searchParams={searchParams} />
    </>
  );
}
