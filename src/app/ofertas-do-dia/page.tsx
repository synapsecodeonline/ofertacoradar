import Link from "next/link";
import { after } from "next/server";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { maybeSyncLomadee, maybeSyncML } from "@/lib/syncer";
import { siteUrl } from "@/lib/site";
import ProductCard from "@/components/ProductCard";
import { IconTag } from "@/components/Icons";
import CollapsibleSection from "@/components/CollapsibleSection";
import { HomeExperience } from "@/components/HomeExperience";
import { ALL_SOURCES, SOURCE_PREFIX } from "@/lib/sources";

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
  // Sync das fontes a cada pageview (nunca bloqueia a resposta).
  // Retornar a promise e obrigatorio: sem isso o after() resolve na
  // hora e a function congela logo apos a resposta, matando o sync.
  after(() =>
    Promise.all([
      maybeSyncLomadee().catch(() => {}),
      maybeSyncML().catch(() => {}),
    ]),
  );
  // Sem params de catalogo = tela "Ofertas do dia" (so o dia).
  // Com ?aba=/?loja=/filtros = visao completa de catalogo.
  const catalogMode = CATALOG_PARAMS.some((k) => {
    const v = sp[k];
    return typeof v === "string" ? v !== "" : Array.isArray(v) && v.length > 0;
  });
  const rpage = Math.max(1, Number(sp.rpage) || 1);
  const [topDiscountsAll] = await Promise.all([
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

  const total = topDiscountsAll.length;

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
          {/* "Terminando em breve" so tinha cupons (unica fonte com endsAt)
              — agora vive na pagina /cupons. */}
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
