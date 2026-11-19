import type { Metadata } from "next";
import { HomeExperience } from "@/components/HomeExperience";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Ofertaço Radar — ofertas e cupons das melhores lojas",
    template: `%s | Ofertaço Radar`,
  },
  description:
    "Ofertas verificadas das lojas parceiras: produtos com desconto, cupons e promoções das melhores lojas.",
  alternates: { canonical: siteUrl() },
};

// A home É o catálogo: abas por fonte (Lomadee, Mercado Livre, Awin),
// busca e filtros — tudo ranqueado por desconto.
export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return <HomeExperience searchParams={searchParams} />;
}
