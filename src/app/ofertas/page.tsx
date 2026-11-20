import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/db";
import ProductCard from "@/components/ProductCard";
import { CATEGORY_ORDER, categoryLabel, canonicalCategory } from "@/lib/categories";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Ofertas verificadas | ${SITE_NAME}`,
  description:
    "As melhores ofertas do Brasil verificadas todo dia: produtos, promoções e cupons de Amazon, Mercado Livre, Lomadee e mais.",
  alternates: { canonical: "/ofertas" },
};

const WHERE: Prisma.ProductWhereInput = {
  active: true,
  imageUrl: { not: null },
  AND: [
    {
      OR: [
        { externalId: { startsWith: "prod-lomadee:" } },
        { externalId: { startsWith: "camp-lomadee:" } },
        { externalId: { startsWith: "ml:" } },
        { externalId: { startsWith: "aw:" } },
        { externalId: { startsWith: "amz:" } },
      ],
    },
    { OR: [{ price: null }, { price: { not: 0 } }] },
    { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
  ],
};

export default async function OfertasPage() {
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: WHERE,
      orderBy: [{ discountPct: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      take: 8,
    }),
    prisma.product.count({ where: WHERE }),
  ]);

  const categories = CATEGORY_ORDER.slice(0, 12);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10 pt-6">
      {/* Hero compacto */}
      <section className="mb-6 rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white px-5 py-6 text-center dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-teal-950/10 dark:to-zinc-900 sm:py-8">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
          Lomadee · Mercado Livre · Amazon
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-3xl">
          {SITE_NAME}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          {total.toLocaleString("pt-BR")} ofertas conferidas · preço e estoque
          atualizados todo dia
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/#catalogo"
            className="inline-flex h-11 items-center rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            Ver ofertas
          </Link>
          <Link
            href="/?aba=cupons"
            className="inline-flex h-11 items-center rounded-xl border border-zinc-200 bg-white px-6 text-sm font-bold text-zinc-700 transition-colors hover:border-emerald-400 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Cupons de desconto
          </Link>
        </div>
      </section>

      {/* Categorias */}
      <nav aria-label="Categorias" className="mb-6">
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">
          Categorias
        </p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Link
              key={c}
              href={`/?categoria=${encodeURIComponent(canonicalCategory(c))}`}
              className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-emerald-400 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-emerald-400"
            >
              {categoryLabel(c)}
            </Link>
          ))}
        </div>
      </nav>

      {/* Ofertas em destaque */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-zinc-500">
            Ofertas em destaque
          </h2>
          <Link
            href="/"
            className="text-xs font-bold text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Ver todas →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <footer className="mt-10 text-center text-[11px] text-zinc-400">
        <p>
          {SITE_NAME} — ofertas de verdade, verificadas todo dia. Links de
          parceiro, sem custo extra pra você.
        </p>
      </footer>
    </div>
  );
}
