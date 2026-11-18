import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { discountPercent, formatPrice } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import ProductCard from "@/components/ProductCard";
import CountdownTimer from "@/components/CountdownTimer";
import { IconFlame, IconTag, IconZap } from "@/components/Icons";
import CollapsibleSection from "@/components/CollapsibleSection";
import { HomeExperience } from "@/components/HomeExperience";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Ofertas do dia",
    description:
      "As maiores ofertas do dia: maiores descontos, produtos terminando em breve e os mais aproveitados agora.",
    alternates: { canonical: `${siteUrl()}/ofertas-do-dia` },
  };
}

const VALID = {
  active: true,
  imageUrl: { not: null },
  AND: [
    { OR: [{ price: null }, { price: { not: 0 } }] },
    { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
  ],
};

const CATALOG_PARAMS = [
  "aba",
  "q",
  "categoria",
  "loja",
  "ordem",
  "tipo",
  "pagina",
  "fonte",
] as const;

export default async function OfertasDoDiaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  // Sem params de catalogo = tela "Ofertas do dia" (so o dia).
  // Com ?aba=/?loja=/filtros = visao completa de catalogo.
  const catalogMode = CATALOG_PARAMS.some((k) => {
    const v = sp[k];
    return typeof v === "string" ? v !== "" : Array.isArray(v) && v.length > 0;
  });
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3_600_000);
  const [topDiscounts, endingSoon, clicked] = await Promise.all([
    prisma.product.findMany({
      where: { ...VALID, discountPct: { gt: 0 } },
      orderBy: { discountPct: "desc" },
      take: 24,
    }),
    prisma.product.findMany({
      where: {
        ...VALID,
        endsAt: { gte: now, lte: new Date(now.getTime() + 48 * 3_600_000) },
      },
      orderBy: { endsAt: "asc" },
      take: 12,
    }),
    prisma.click.groupBy({
      by: ["productId"],
      where: { createdAt: { gte: dayAgo } },
      _count: { _all: true },
      orderBy: { _count: { productId: "desc" } },
      take: 12,
    }),
  ]);

  const clickedIds = clicked.map((c) => c.productId);
  const popular = clickedIds.length
    ? await prisma.product.findMany({
        where: { ...VALID, id: { in: clickedIds } },
      })
    : [];
  const clickCount = new Map(clicked.map((c) => [c.productId, c._count._all]));
  popular.sort(
    (a, b) => (clickCount.get(b.id) ?? 0) - (clickCount.get(a.id) ?? 0),
  );

  const total = topDiscounts.length + endingSoon.length + popular.length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8">
      {!catalogMode && (
      <header className="flex flex-col gap-2">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
          <Link href="/ofertas-do-dia" className="transition-colors hover:text-emerald-600">
            Início
          </Link>
          <span>/</span>
          <span className="text-zinc-500">Ofertas do dia</span>
        </nav>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Ofertas do dia
        </h1>
        <p className="max-w-xl text-sm text-zinc-500">
          Os maiores descontos de hoje, o que está terminando em breve e o que
          todo mundo está aproveitando. Preços verificados nas lojas parceiras.
        </p>
      </header>
      )}

      {catalogMode ? null : total === 0 ? (
        <p className="py-16 text-center text-zinc-500">
          Nenhuma oferta ativa no momento. Volte em breve!
        </p>
      ) : (
        <>
          {endingSoon.length > 0 && (
            <CollapsibleSection
              className="border-amber-200/70 bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-50 dark:border-amber-900/40 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-amber-950/30"
              title={
                <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                  <IconZap className="h-4 w-4" /> Terminando em breve
                </h2>
              }
              meta={
                <span className="text-xs font-medium text-amber-600/80 dark:text-amber-500/80">
                  {endingSoon.length} ofertas
                </span>
              }
            >
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:thin]">
                {endingSoon.map((p) => (
                  <Link
                    key={p.id}
                    href={`/produto/${p.id}`}
                    className="group flex w-52 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-amber-200/60 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-amber-900/40 dark:bg-zinc-900"
                  >
                    <div className="relative aspect-[4/3] bg-zinc-50 dark:bg-zinc-950">
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt={p.title}
                          className="h-full w-full object-contain p-2"
                        />
                      )}
                      {(() => {
                        const d =
                          p.discountPct ??
                          discountPercent(p.price, p.oldPrice);
                        return d !== null ? (
                          <span className="absolute left-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                            -{d}%
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-2.5">
                      <h3 className="line-clamp-2 text-xs font-semibold leading-snug">
                        {p.title}
                      </h3>
                      {p.price != null && (
                        <span className="mt-auto text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                          {formatPrice(p.price, p.currency)}
                        </span>
                      )}
                      {p.endsAt && <CountdownTimer endsAt={p.endsAt.toISOString()} />}
                    </div>
                  </Link>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {popular.length > 0 && (
            <CollapsibleSection
              className="border-orange-200/70 bg-gradient-to-r from-orange-50 via-rose-50/60 to-orange-50 dark:border-orange-900/40 dark:from-orange-950/30 dark:via-rose-950/20 dark:to-orange-950/30"
              title={
                <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-orange-600 dark:text-orange-400">
                  <IconFlame className="h-4 w-4" /> Mais aproveitadas (24h)
                </h2>
              }
              meta={
                <span className="text-xs font-medium text-orange-600/80 dark:text-orange-500/80">
                  por cliques reais
                </span>
              }
            >
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {popular.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    clicks={clickCount.get(p.id)}
                  />
                ))}
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection
            title={
              <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                <IconTag className="h-4 w-4" /> Ranking do dia
              </h2>
            }
            meta={
              <span className="text-xs font-medium text-emerald-600/80 dark:text-emerald-500/80">
                Maiores descontos de hoje · {topDiscounts.length} ofertas
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-4 pb-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {topDiscounts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </CollapsibleSection>
        </>
      )}

      {/* Home completa: hero, abas por fonte, lojas em destaque e catalogo.
          embedded oculta as secoes de trilho (a pagina ja tem equivalentes). */}
      <HomeExperience searchParams={searchParams} embedded dayOnly={!catalogMode} />

      <p className="flex items-center gap-2 pb-8 text-center text-xs text-zinc-400">
        <IconTag className="h-3.5 w-3.5" />
        Preços e descontos verificados nas lojas parceiras — podem sofrer
        alterações sem aviso.
      </p>
    </div>
  );
}
