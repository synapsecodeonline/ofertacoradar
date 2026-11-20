import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  canonicalCategory,
  categoryLabel,
  CATEGORY_ORDER,
  CATEGORY_LABEL,
} from "@/lib/categories";
import { siteUrl, SITE_NAME } from "@/lib/site";
import ProductCard from "@/components/ProductCard";
import { IconTag } from "@/components/Icons";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 48;

function introFor(slug: string, count: number): string {
  const label = categoryLabel(slug);
  const n = count.toLocaleString("pt-BR");
  return `Ofertas e produtos de ${label.toLowerCase()} verificadas diariamente nas nossas lojas parceiras — Lomadee, Mercado Livre e Amazon. ${n} itens ativos com preços atualizados, cupons quando disponíveis e links diretos para comprar com desconto.`;
}

export async function generateMetadata({
  params,
}: PageProps<"/categoria/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const cat = canonicalCategory(slug);
  if (!cat || !CATEGORY_ORDER.includes(cat)) return {};
  const count = await prisma.product.count({
    where: {
      active: true,
      category: { in: [cat] },
      imageUrl: { not: null },
      OR: [{ price: null }, { price: { not: 0 } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] }],
    },
  });
  const label = categoryLabel(cat);
  return {
    title: `Ofertas de ${label} — ${count.toLocaleString("pt-BR")} produtos com desconto`,
    description: introFor(cat, count),
    alternates: { canonical: `${siteUrl()}/categoria/${cat}` },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      title: `Ofertas de ${label} | ${SITE_NAME}`,
      description: introFor(cat, count),
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/categoria/[slug]"> & {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { slug } = await params;
  const { pagina } = await searchParams;
  const cat = canonicalCategory(slug);
  if (!cat || !CATEGORY_ORDER.includes(cat)) notFound();

  const page = Math.max(1, Number(pagina) || 1);
  const where: import("@prisma/client").Prisma.ProductWhereInput = {
    active: true,
    category: cat,
    imageUrl: { not: null },
    AND: [
      { OR: [{ price: null }, { price: { not: 0 } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
    ],
  };

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { discountPct: { sort: "desc", nulls: "last" } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where }),
  ]);
  if (page === 1 && total === 0) notFound();

  const label = categoryLabel(cat);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const intro = introFor(cat, total);
  const pageUrl = (p: number) =>
    p === 1 ? `/categoria/${cat}` : `/categoria/${cat}?pagina=${p}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Ofertas de ${label}`,
    description: intro,
    url: `${siteUrl()}/categoria/${cat}`,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: siteUrl() },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: total,
      itemListElement: items.slice(0, 10).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${siteUrl()}/produto/${p.id}`,
        name: p.title,
      })),
    },
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="mb-4 flex items-center gap-1.5 text-xs font-medium text-zinc-500" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-emerald-600">
          Início
        </Link>
        <span>/</span>
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          {label}
        </span>
      </nav>

      <header className="mb-6">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-600">
          Categoria
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Ofertas de {label.toLowerCase()}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">
          {intro}
        </p>
        <p className="mt-2 text-sm font-semibold text-zinc-500">
          {total.toLocaleString("pt-BR")} produtos
          {page > 1 ? ` · página ${page} de ${totalPages}` : ""}
        </p>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <IconTag className="h-10 w-10 text-zinc-300" />
          <p className="text-lg font-bold text-zinc-700 dark:text-zinc-200">
            Nenhuma oferta nesta categoria no momento
          </p>
          <Link
            href="/"
            className="mt-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            Ver todas as ofertas
          </Link>
        </div>
      ) : (
        <main className="grid grid-cols-2 gap-4 pb-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </main>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-4 pb-10 text-sm">
          {page > 1 && (
            <Link
              href={pageUrl(page - 1)}
              className="rounded-full bg-white px-4 py-2 font-medium shadow-sm hover:bg-zinc-100 dark:bg-zinc-900"
            >
              ← Anterior
            </Link>
          )}
          <span className="text-zinc-500">
            Página {page} de {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={pageUrl(page + 1)}
              className="rounded-full bg-white px-4 py-2 font-medium shadow-sm hover:bg-zinc-100 dark:bg-zinc-900"
            >
              Próxima →
            </Link>
          )}
        </nav>
      )}

      <p className="mt-4 border-t border-zinc-200 pt-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
        Veja também:{" "}
        {CATEGORY_ORDER.filter((c) => c !== cat)
          .slice(0, 8)
          .map((c, i) => (
            <span key={c}>
              {i > 0 && " · "}
              <Link
                href={`/categoria/${c}`}
                className="font-semibold text-emerald-600 hover:underline"
              >
                {categoryLabel(c)}
              </Link>
            </span>
          ))}
      </p>
    </div>
  );
}
