import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { discountPercent, formatPrice } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import ProductCard from "@/components/ProductCard";
import CountdownTimer from "@/components/CountdownTimer";
import { IconTag, IconZap } from "@/components/Icons";
import CollapsibleSection from "@/components/CollapsibleSection";
import { HomeExperience } from "@/components/HomeExperience";
import { ALL_SOURCES, SOURCE_PREFIX, sourceBadgeOf } from "@/lib/sources";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Ofertas do dia",
    description:
      "As maiores ofertas do dia: maiores descontos e produtos terminando em breve.",
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

const RANKING_PAGE_SIZE = 24;

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
  const rpage = Math.max(1, Number(sp.rpage) || 1);
  const now = new Date();
  const [topDiscountsAll, endingSoon] = await Promise.all([
    // Top descontos de cada fonte -> merge ordenado e paginado.
    // Garante que Mercado Livre/Awin aparecam mesmo com poucos descontos.
    Promise.all(
      ALL_SOURCES.map((src) =>
        prisma.product.findMany({
          where: {
            ...VALID,
            discountPct: { gt: 0 },
            externalId: { startsWith: SOURCE_PREFIX[src] },
          },
          orderBy: { discountPct: "desc" },
          take: 30,
        }),
      ),
    ).then((groups) =>
      groups
        .flat()
        .sort((a, b) => (b.discountPct ?? 0) - (a.discountPct ?? 0)),
    ),
    prisma.product.findMany({
      where: {
        ...VALID,
        endsAt: { gte: now, lte: new Date(now.getTime() + 48 * 3_600_000) },
      },
      orderBy: { endsAt: "asc" },
      take: 12,
    }),
  ]);

  const rankingTotalPages = Math.max(
    1,
    Math.ceil(topDiscountsAll.length / RANKING_PAGE_SIZE),
  );
  const rpageSafe = Math.min(rpage, rankingTotalPages);
  const topDiscounts = topDiscountsAll.slice(
    (rpageSafe - 1) * RANKING_PAGE_SIZE,
    rpageSafe * RANKING_PAGE_SIZE,
  );
  const rankingQs = (page: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === "string" && v !== "") p.set(k, v);
    }
    if (page > 1) p.set("rpage", String(page));
    else p.delete("rpage");
    const s = p.toString();
    return s ? `/ofertas-do-dia?${s}` : "/ofertas-do-dia";
  };

  const total = topDiscountsAll.length + endingSoon.length;

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
          Os maiores descontos de hoje e o que está terminando em breve. Preços verificados nas lojas parceiras.
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
                {endingSoon.map((p) => {
                  const badge = sourceBadgeOf(p.externalId);
                  return (
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
                      {badge && (
                        <span className={`w-fit rounded px-1 py-px text-[9px] font-extrabold uppercase tracking-wider ${badge.className}`}>
                          {badge.label}
                        </span>
                      )}
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
                  );
                })}
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection
            className="border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20"
            title={
              <span className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  Ofertas do dia
                </span>
                <span className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
                  Ranking do dia
                </span>
              </span>
            }
            meta={
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Maiores descontos · {topDiscountsAll.length} ofertas
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-4 pb-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {topDiscounts.map((p) => (
                <ProductCard key={p.id} product={p} showSource />
              ))}
            </div>
            {rankingTotalPages > 1 && (
              <nav className="flex items-center justify-center gap-4 pt-4 text-sm">
                {rpageSafe > 1 && (
                  <Link
                    href={rankingQs(rpageSafe - 1)}
                    className="rounded-full bg-white px-4 py-2 font-medium shadow-sm hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    ← Anterior
                  </Link>
                )}
                <span className="text-zinc-500">
                  Página {rpageSafe} de {rankingTotalPages}
                </span>
                {rpageSafe < rankingTotalPages && (
                  <Link
                    href={rankingQs(rpageSafe + 1)}
                    className="rounded-full bg-white px-4 py-2 font-medium shadow-sm hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    Próxima →
                  </Link>
                )}
              </nav>
            )}
          </CollapsibleSection>
        </>
      )}

      {/* Home completa: hero, abas por fonte, lojas em destaque e catalogo.
          embedded oculta as secoes de trilho (a pagina ja tem equivalentes). */}
      <HomeExperience searchParams={searchParams} dayOnly={!catalogMode} />

      <p className="flex items-center gap-2 pb-8 text-center text-xs text-zinc-400">
        <IconTag className="h-3.5 w-3.5" />
        Preços e descontos verificados nas lojas parceiras — podem sofrer
        alterações sem aviso.
      </p>
    </div>
  );
}
