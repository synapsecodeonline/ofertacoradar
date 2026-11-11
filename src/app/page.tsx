import Link from "next/link";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { maybeSync } from "@/lib/syncer";
import ProductCard from "@/components/ProductCard";
import SearchBar from "@/components/SearchBar";
import { categoryLabel } from "@/lib/categories";
import { IconCheck, IconRefresh, IconShield } from "@/components/Icons";
import FeaturedCarousel, {
  type FeaturedItem,
} from "@/components/FeaturedCarousel";
import { discountPercent, formatPrice } from "@/lib/format";
import { urgencyLabel } from "@/lib/urgency";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 48;
const OFFERS_LIMIT = 120;

// Esconde itens com preco zerado (R$0,00) e ofertas expiradas
const notZeroPrice = {
  OR: [{ price: null }, { price: { not: 0 } }],
};
const notExpired = {
  OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
};

const SORTS = {
  desconto: { label: "Maior desconto" },
  recentes: { label: "Mais recentes" },
  terminando: { label: "Terminando em breve" },
  populares: { label: "Mais populares" },
} as const;

type SortKey = keyof typeof SORTS;

function orderByFor(sort: SortKey) {
  switch (sort) {
    case "desconto":
      return { discountPct: { sort: "desc" as const, nulls: "last" as const } };
    case "terminando":
      return { endsAt: { sort: "asc" as const, nulls: "last" as const } };
    case "populares":
      return { clicks: { _count: "desc" as const } };
    default:
      return { updatedAt: "desc" as const };
  }
}

export async function generateMetadata() {
  return {
    title: "Cupons e ofertas com desconto",
    description:
      "Cupons, ofertas e produtos selecionados das melhores lojas. Ofertas verificadas com links diretos para aproveitar o desconto.",
  };
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const { q, categoria, aba, pagina, ordem, loja } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const category = typeof categoria === "string" ? categoria : "";
  const tab = aba === "ofertas" ? "ofertas" : "produtos";
  const page = Math.max(1, Number(pagina) || 1);
  const merchant = typeof loja === "string" ? loja : "";
  const sort: SortKey =
    ordem === "recentes" || ordem === "terminando" || ordem === "populares"
      ? ordem
      : tab === "ofertas"
        ? "desconto"
        : "recentes";

  const isOffer = { externalId: { startsWith: "camp:" } };
  const isCatalogProduct = { externalId: { startsWith: "prod:" } };
  const searchFilter = query
    ? {
        OR: [
          { title: { contains: query } },
          { description: { contains: query } },
          { merchant: { contains: query } },
        ],
      }
    : {};
  const listWhere = (kind: "ofertas" | "produtos") => ({
    active: true,
    AND: [
      kind === "ofertas" ? isOffer : isCatalogProduct,
      notZeroPrice,
      notExpired,
      { imageUrl: { not: null } },
      category ? { category: { contains: category } } : {},
      merchant
        ? { merchant: { equals: merchant, mode: "insensitive" as const } }
        : {},
      searchFilter,
    ],
  });

  // Sync incremental em background: nao bloqueia a resposta
  after(() => maybeSync().catch(() => {}));

  const [offers, products, totalOffers, totalProducts, categories, merchants, featured] =
    await Promise.all([
      tab === "ofertas"
        ? prisma.product.findMany({
            where: listWhere("ofertas"),
            orderBy: orderByFor(sort),
            take: OFFERS_LIMIT,
          })
        : Promise.resolve([]),
      tab === "produtos"
        ? prisma.product.findMany({
            where: listWhere("produtos"),
            orderBy: orderByFor(sort),
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
          })
        : Promise.resolve([]),
      prisma.product.count({ where: listWhere("ofertas") }),
      prisma.product.count({ where: listWhere("produtos") }),
      prisma.product.findMany({
        where: {
          active: true,
          category: { not: null },
          AND: [
            tab === "ofertas" ? isOffer : isCatalogProduct,
            notZeroPrice,
            notExpired,
            { imageUrl: { not: null } },
          ],
        },
        select: { category: true },
        distinct: ["category"],
      }),
      prisma.product.findMany({
        where: {
          active: true,
          merchant: { not: null },
          AND: [
            tab === "ofertas" ? isOffer : isCatalogProduct,
            notZeroPrice,
            notExpired,
            { imageUrl: { not: null } },
          ],
        },
        select: { merchant: true },
        distinct: ["merchant"],
      }),
      // Ofertas em destaque: maiores descontos do tipo ativo na aba
      prisma.product.findMany({
        where: listWhere(tab),
        orderBy: { discountPct: { sort: "desc", nulls: "last" } },
        take: 5,
      }),
    ]);

  const categoryList = categories
    .map((c) => c.category)
    .filter((c): c is string => !!c)
    .sort();
  const merchantList = merchants
    .map((m) => m.merchant)
    .filter((m): m is string => !!m)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .slice(0, 200);

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (category) p.set("categoria", category);
    if (merchant) p.set("loja", merchant);
    p.set("aba", tab);
    const defaultSort = tab === "ofertas" ? "desconto" : "recentes";
    if (sort !== defaultSort) p.set("ordem", sort);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const hasNextPage = page < totalPages;
  const items = tab === "ofertas" ? offers : products;

  const featuredItems: FeaturedItem[] = featured.map((p) => ({
    id: p.id,
    title: p.title,
    merchant: p.merchant,
    imageUrl: p.imageUrl,
    priceLabel: formatPrice(p.price, p.currency),
    oldPriceLabel:
      p.oldPrice != null && p.price != null && p.oldPrice > p.price
        ? formatPrice(p.oldPrice, p.currency)
        : null,
    discount: p.discountPct ?? discountPercent(p.price, p.oldPrice),
    urgent: urgencyLabel(p.endsAt),
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4">
      {/* Hero */}
      <section className="relative -mx-4 mb-8 overflow-hidden rounded-b-[2rem] bg-zinc-950 px-4 pb-12 pt-12 text-white sm:pt-16">
        {/* brilhos de fundo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[52rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 right-[-10%] h-80 w-80 rounded-full bg-teal-500/10 blur-3xl"
        />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Coluna esquerda */}
          <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-300 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {totalProducts + totalOffers} ofertas ativas agora
            </span>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Os melhores descontos,
              <span className="block bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                selecionados pra você
              </span>
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-zinc-400 sm:text-base">
              Cupons, ofertas e produtos das melhores lojas — verificados,
              com links diretos e sem custo extra.
            </p>

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex flex-col items-center lg:items-start">
                <span className="text-xl font-extrabold text-white">{totalProducts.toLocaleString("pt-BR")}</span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">produtos</span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col items-center lg:items-start">
                <span className="text-xl font-extrabold text-white">{totalOffers.toLocaleString("pt-BR")}</span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">ofertas</span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col items-center lg:items-start">
                <span className="text-xl font-extrabold text-white">{merchantList.length}+</span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">lojas</span>
              </div>
            </div>
          </div>

          {/* Coluna direita: carrossel de ofertas em destaque */}
          {featuredItems.length > 0 && (
            <FeaturedCarousel items={featuredItems} />
          )}
        </div>

        {/* Controles */}
        <div className="relative mx-auto mt-10 flex w-full max-w-6xl flex-col items-center gap-4">
          {/* Abas */}
          <nav className="flex rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
            <Link
              href={qs({ aba: "produtos" })}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                tab === "produtos"
                  ? "bg-white text-zinc-950 shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Produtos{totalProducts > 0 ? ` (${totalProducts})` : ""}
            </Link>
            <Link
              href={qs({ aba: "ofertas" })}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                tab === "ofertas"
                  ? "bg-white text-zinc-950 shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Ofertas e Cupons{totalOffers > 0 ? ` (${totalOffers})` : ""}
            </Link>
          </nav>

          <Suspense>
            <SearchBar merchants={merchantList} currentMerchant={merchant} />
          </Suspense>

          {/* Ordenacao */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
            <span className="mr-1 font-semibold text-zinc-500">Ordenar por</span>
            <div className="flex flex-wrap justify-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
              {(Object.keys(SORTS) as SortKey[]).map((s) => (
                <Link
                  key={s}
                  href={qs({ ordem: s })}
                  className={`rounded-full px-3 py-1 font-medium transition-all ${
                    sort === s
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-zinc-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {SORTS[s].label}
                </Link>
              ))}
            </div>
          </div>

          {/* Faixa de confianca */}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5 text-xs font-medium text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <IconCheck className="h-3.5 w-3.5 text-emerald-400" /> Ofertas verificadas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconRefresh className="h-3.5 w-3.5 text-emerald-400" /> Atualizado diariamente
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconShield className="h-3.5 w-3.5 text-emerald-400" /> Compra 100% na loja parceira
            </span>
          </div>
        </div>
      </section>

      {categoryList.length > 0 && (
        <nav className="sticky top-14 z-[5] -mx-4 mb-2 mt-6 border-y border-zinc-200/60 bg-zinc-50/80 px-4 py-3 backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-950/80">
          <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-2">
            {categoryList.map((cat) => (
              <Link
                key={cat}
                href={qs({ categoria: cat })}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                  category === cat
                    ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-700"
                }`}
              >
                {categoryLabel(cat)}
              </Link>
            ))}
          </div>
        </nav>
      )}

      {items.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">
          Nenhuma oferta encontrada. Rode <code>npm run sync</code>.
        </p>
      ) : (
        <>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                {tab === "ofertas" ? "Cupons & ofertas" : "Catálogo"}
              </p>
              <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
                {tab === "ofertas" ? "Ofertas e cupons de hoje" : "Produtos em oferta"}
              </h2>
            </div>
            <span className="text-sm font-medium text-zinc-400">
              {items.length}
              {tab === "produtos" && totalProducts > items.length
                ? ` de ${totalProducts}`
                : ""}{" "}
              {tab === "ofertas" ? "ofertas" : "produtos"}
            </span>
          </div>
          <main className="grid grid-cols-2 gap-4 pb-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </main>
        </>
      )}

      {tab === "produtos" && (page > 1 || hasNextPage) && (
        <nav className="flex items-center justify-center gap-4 pb-12 text-sm">
          {page > 1 && (
            <Link
              href={qs({ pagina: String(page - 1) })}
              className="rounded-full bg-white px-4 py-2 font-medium shadow-sm hover:bg-zinc-100 dark:bg-zinc-900"
            >
              ← Anterior
            </Link>
          )}
          <span className="text-zinc-500">
            Página {page} de {totalPages}
          </span>
          {hasNextPage && (
            <Link
              href={qs({ pagina: String(page + 1) })}
              className="rounded-full bg-white px-4 py-2 font-medium shadow-sm hover:bg-zinc-100 dark:bg-zinc-900"
            >
              Próxima →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
