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

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Ofertas do dia",
    description:
      "Ofertas Lomadee e produtos Mercado Livre ranqueados por desconto. Preços verificados nas lojas parceiras.",
    alternates: { canonical: `${siteUrl()}/ofertas-do-dia` },
  };
}

const PAGE_SIZE = 24;

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

function Pager({
  base,
  page,
  totalPages,
  param,
}: {
  base: string;
  page: number;
  totalPages: number;
  param: string;
}) {
  if (totalPages <= 1) return null;
  const qs = (p: number) => {
    const sp = new URLSearchParams();
    if (p > 1) sp.set(param, String(p));
    const s = sp.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <nav className="flex items-center justify-center gap-4 pt-4 text-sm">
      {page > 1 && (
        <Link
          href={qs(page - 1)}
          className="rounded-full bg-white px-4 py-2 font-medium shadow-sm hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          ← Anterior
        </Link>
      )}
      <span className="text-zinc-500">
        Página {page} de {totalPages}
      </span>
      {page < totalPages && (
        <Link
          href={qs(page + 1)}
          className="rounded-full bg-white px-4 py-2 font-medium shadow-sm hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          Próxima →
        </Link>
      )}
    </nav>
  );
}

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

  const lpage = Math.max(1, Number(sp.lpage) || 1);
  const mpage = Math.max(1, Number(sp.mpage) || 1);

  const [lomadeeAll, mlAll] = await Promise.all([
    // Ofertas/cupons Lomadee: os que expiram primeiro no topo
    prisma.product.findMany({
      where: { ...VALID, externalId: { startsWith: "camp-lomadee:" } },
      orderBy: [{ endsAt: { sort: "asc", nulls: "last" } }, { id: "desc" }],
    }),
    // Mercado Livre: ranking por maior desconto
    prisma.product.findMany({
      where: {
        ...VALID,
        externalId: { startsWith: "ml:" },
        discountPct: { gt: 0 },
      },
      orderBy: { discountPct: "desc" },
    }),
  ]);

  const lPages = Math.max(1, Math.ceil(lomadeeAll.length / PAGE_SIZE));
  const lSafe = Math.min(lpage, lPages);
  const lomadee = lomadeeAll.slice(
    (lSafe - 1) * PAGE_SIZE,
    lSafe * PAGE_SIZE,
  );

  const mPages = Math.max(1, Math.ceil(mlAll.length / PAGE_SIZE));
  const mSafe = Math.min(mpage, mPages);
  const ml = mlAll.slice((mSafe - 1) * PAGE_SIZE, mSafe * PAGE_SIZE);

  const total = lomadeeAll.length + mlAll.length;

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
            Ofertas Lomadee e os maiores descontos do Mercado Livre. Preços
            verificados nas lojas parceiras.
          </p>
        </header>
      )}

      {catalogMode ? null : total === 0 ? (
        <p className="py-16 text-center text-zinc-500">
          Nenhuma oferta ativa no momento. Volte em breve!
        </p>
      ) : (
        <>
          {lomadeeAll.length > 0 && (
            <CollapsibleSection
              className="border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20"
              title={
                <span className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                    Ofertas do dia
                  </span>
                  <span className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
                    Ofertas Lomadee
                  </span>
                </span>
              }
              meta={
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {lomadeeAll.length} ofertas
                </span>
              }
            >
              <div className="grid grid-cols-2 gap-4 pb-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {lomadee.map((p) => (
                  <ProductCard key={p.id} product={p} showSource />
                ))}
              </div>
              <Pager base="/ofertas-do-dia" page={lSafe} totalPages={lPages} param="lpage" />
            </CollapsibleSection>
          )}

          {mlAll.length > 0 && (
            <CollapsibleSection
              className="border-sky-100 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20"
              title={
                <span className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400">
                    Ranking
                  </span>
                  <span className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
                    Mercado Livre
                  </span>
                </span>
              }
              meta={
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Maiores descontos · {mlAll.length} produtos
                </span>
              }
            >
              <div className="grid grid-cols-2 gap-4 pb-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {ml.map((p) => (
                  <ProductCard key={p.id} product={p} showSource />
                ))}
              </div>
              <Pager base="/ofertas-do-dia" page={mSafe} totalPages={mPages} param="mpage" />
            </CollapsibleSection>
          )}
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
