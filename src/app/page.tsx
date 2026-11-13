import Link from "next/link";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { maybeSync } from "@/lib/syncer";
import ProductCard from "@/components/ProductCard";
import SearchBar from "@/components/SearchBar";
import { categoryLabel, canonicalCategory, CATEGORY_ORDER, rawSlugsFor, subtypesFor } from "@/lib/categories";
import {
  IconCheck,
  IconFlame,
  IconRefresh,
  IconShield,
  IconZap,
} from "@/components/Icons";
import FeaturedCarousel, {
  type FeaturedItem,
} from "@/components/FeaturedCarousel";
import CountdownTimer from "@/components/CountdownTimer";
import CategoryNav from "@/components/CategoryNav";
import CollapsibleSection from "@/components/CollapsibleSection";
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
  const { q, categoria, aba, pagina, ordem, loja, tipo } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const rawCat = typeof categoria === "string" ? categoria : "";
  const category = rawCat ? canonicalCategory(rawCat) : "";
  const rawSub = typeof tipo === "string" ? tipo : "";
  const subDefs = subtypesFor(category);
  const subtype = subDefs.some((d) => d.slug === rawSub) ? rawSub : "";
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
      category ? { category: { in: rawSlugsFor(category) } } : {},
      category && subtype ? { subtype } : {},
      merchant
        ? { merchant: { equals: merchant, mode: "insensitive" as const } }
        : {},
      searchFilter,
    ],
  });

  // Sync incremental em background: nao bloqueia a resposta
  after(() => maybeSync().catch(() => {}));

  const FLASH_WINDOW_MS = 48 * 3_600_000;
  const now = new Date();

  const [
    offers,
    products,
    totalOffers,
    totalProducts,
    categories,
    merchants,
    featured,
    flashDeals,
    topClicks,
  ] = await Promise.all([
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
      // Relampago: terminam nas proximas 48h, mais urgentes primeiro.
      // Independe da aba: oferta que expira e oferta em qualquer aba.
      prisma.product.findMany({
        where: {
          active: true,
          AND: [
            notZeroPrice,
            { imageUrl: { not: null } },
            category ? { category: { in: rawSlugsFor(category) } } : {},
            merchant
              ? { merchant: { equals: merchant, mode: "insensitive" as const } }
              : {},
            searchFilter,
            {
              endsAt: {
                gte: now,
                lte: new Date(now.getTime() + FLASH_WINDOW_MS),
              },
            },
          ],
        },
        orderBy: { endsAt: "asc" },
        take: 12,
      }),
      // Cliques nas ultimas 48h -> prova social real ("aproveitadas agora")
      prisma.click.groupBy({
        by: ["productId"],
        where: { createdAt: { gte: new Date(now.getTime() - 48 * 3_600_000) } },
        _count: { _all: true },
        orderBy: { _count: { productId: "desc" } },
        take: 40,
      }),
    ]);

  // Lojas afiliadas reais (com logo quando disponivel) para o hero
  const orgs = await prisma.affiliatedOrg.findMany({
    select: { organizationId: true, name: true },
  });
  const storeBrands = orgs.length
    ? await prisma.brand.findMany({
        where: { id: { in: orgs.map((o) => o.organizationId) } },
        select: { id: true, name: true, logo: true },
      })
    : [];
  const storeNameByOrg = new Map(orgs.map((o) => [o.organizationId, o.name]));
  const heroStores = storeBrands
    .map((b) => ({
      key: b.id,
      name: b.name ?? storeNameByOrg.get(b.id) ?? "Loja",
      logo: b.logo,
    }))
    .filter((s) => s.name)
    .slice(0, 12);
  const storeCount = orgs.length;

  const categoryList = [
    ...new Set(
      categories
        .map((c) => (c.category ? canonicalCategory(c.category) : null))
        .filter((c): c is string => !!c),
    ),
  ].sort(
    (a, b) =>
      (CATEGORY_ORDER.indexOf(a) + 1 || 999) -
      (CATEGORY_ORDER.indexOf(b) + 1 || 999),
  );

  // Contagem por subtipo dentro da categoria ativa (mesmos filtros da lista)
  const subtypeCounts = new Map<string, number>();
  if (subDefs.length) {
    const facets = await prisma.product.groupBy({
      by: ["subtype"],
      where: {
        active: true,
        subtype: { not: null },
        AND: [
          tab === "ofertas" ? isOffer : isCatalogProduct,
          notZeroPrice,
          notExpired,
          { imageUrl: { not: null } },
          { category: { in: rawSlugsFor(category) } },
          merchant
            ? { merchant: { equals: merchant, mode: "insensitive" as const } }
            : {},
          searchFilter,
        ],
      },
      _count: { _all: true },
    });
    for (const f of facets) {
      if (f.subtype) subtypeCounts.set(f.subtype, f._count._all);
    }
  }
  // Mostra so subtipos com itens; o subtipo ativo sempre aparece (mesmo zerado)
  const visibleSubs = subDefs.filter(
    (d) => (subtypeCounts.get(d.slug) ?? 0) > 0 || d.slug === subtype,
  );
  const merchantList = merchants
    .map((m) => m.merchant)
    .filter((m): m is string => !!m)
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .slice(0, 200);

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (category) p.set("categoria", category);
    if (category && subtype) p.set("tipo", subtype);
    if (merchant) p.set("loja", merchant);
    p.set("aba", tab);
    const defaultSort = tab === "ofertas" ? "desconto" : "recentes";
    if (sort !== defaultSort) p.set("ordem", sort);
    for (const [k, v] of Object.entries(extra)) {
      if (v === "") p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const hasNextPage = page < totalPages;
  const flashIds = new Set(flashDeals.map((p) => p.id));
  const items = (tab === "ofertas" ? offers : products).filter(
    (p) => !flashIds.has(p.id),
  );

  // Cliques por produto (30d) para prova social nos cards
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
  const clickGroups = items.length
    ? await prisma.click.groupBy({
        by: ["productId"],
        where: {
          productId: { in: items.map((p) => p.id) },
          createdAt: { gte: monthAgo },
        },
        _count: { _all: true },
      })
    : [];
  const clickMap = new Map(clickGroups.map((g) => [g.productId, g._count._all]));

  // "Aproveitadas agora": produtos com mais cliques nas ultimas 48h.
  // Fallback: sem cliques recentes (ex.: banco recém-populado), mostra
  // os maiores descontos ativos — dado real, e volta a ranquear por
  // cliques assim que houver volume.
  const aproveitadasIds = topClicks
    .sort((a, b) => b._count._all - a._count._all)
    .map((g) => g.productId)
    .filter((id) => !flashIds.has(id))
    .slice(0, 12);
  const aproveitadasIsFallback = aproveitadasIds.length === 0;
  let aproveitadas = aproveitadasIds.length
    ? await prisma.product.findMany({
        where: {
          active: true,
          id: { in: aproveitadasIds },
          imageUrl: { not: null },
          AND: [notZeroPrice],
        },
      })
    : [];
  if (!aproveitadas.length) {
    aproveitadas = await prisma.product.findMany({
      where: {
        active: true,
        imageUrl: { not: null },
        discountPct: { gt: 0 },
        AND: [notZeroPrice, notExpired, isOffer],
      },
      orderBy: { discountPct: "desc" },
      take: 12,
    });
  }
  const aproveitadasCount = new Map(
    topClicks.map((g) => [g.productId, g._count._all]),
  );
  aproveitadas.sort(
    (a, b) => (aproveitadasCount.get(b.id) ?? 0) - (aproveitadasCount.get(a.id) ?? 0),
  );

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
                <span className="text-xl font-extrabold text-white">{storeCount}</span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">lojas</span>
              </div>
            </div>

            {/* Lojas parceiras */}
            {heroStores.length > 0 && (
              <div className="flex max-w-lg flex-wrap items-center justify-center gap-1.5 lg:justify-start">
                {heroStores.map((s) => (
                  <span
                    key={s.key}
                    title={s.name}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 text-[11px] font-semibold text-zinc-400 backdrop-blur transition-colors hover:border-emerald-400/40 hover:text-emerald-300"
                  >
                    {s.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.logo} alt="" className="h-4 w-4 rounded-full object-contain" />
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-300">
                        {s.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="max-w-24 truncate">{s.name}</span>
                  </span>
                ))}
                {storeCount > heroStores.length && (
                  <span className="text-[11px] font-semibold text-zinc-500">
                    +{storeCount - heroStores.length}
                  </span>
                )}
              </div>
            )}
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

      {/* Ofertas relampago: terminam em ate 48h */}
      {flashDeals.length > 0 && (
        <CollapsibleSection
          id="relampago"
          className="border-amber-200/70 bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-50 dark:border-amber-900/40 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-amber-950/30"
          title={
            <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-amber-700 dark:text-amber-400">
              <IconZap className="h-4 w-4" />
              Ofertas relâmpago
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-amber-700 dark:text-amber-300">
                terminam em breve
              </span>
            </h2>
          }
          meta={
            <span className="text-xs font-medium text-amber-600/80 dark:text-amber-500/80">
              {flashDeals.length} ofertas
            </span>
          }
        >
            <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory [scrollbar-width:thin]">
              {flashDeals.map((p) => {
                const d = p.discountPct ?? discountPercent(p.price, p.oldPrice);
                const saving =
                  p.price != null && p.oldPrice != null && p.oldPrice > p.price
                    ? p.oldPrice - p.price
                    : null;
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
                      {d !== null && (
                        <span className="absolute left-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                          -{d}%
                        </span>
                      )}
                      {p.couponCode && (
                        <span className="absolute bottom-1.5 left-1.5 rounded bg-zinc-900/85 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">
                          {p.couponCode}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1 p-2.5">
                      <h3 className="line-clamp-2 text-xs font-semibold leading-snug">
                        {p.title}
                      </h3>
                      <div className="mt-auto flex items-baseline gap-1.5">
                        {p.price != null && (
                          <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                            {formatPrice(p.price, p.currency)}
                          </span>
                        )}
                        {saving !== null && saving >= 10 && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            -{formatPrice(saving, p.currency)}
                          </span>
                        )}
                      </div>
                      {p.endsAt && (
                        <CountdownTimer endsAt={p.endsAt.toISOString()} />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
        </CollapsibleSection>
      )}

      {/* Aproveitadas agora: prova social real (cliques 48h) */}
      {aproveitadas.length > 0 && (
        <CollapsibleSection
          className="border-orange-200/70 bg-gradient-to-r from-orange-50 via-rose-50/60 to-orange-50 dark:border-orange-900/40 dark:from-orange-950/30 dark:via-rose-950/20 dark:to-orange-950/30"
          title={
            <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-orange-600 dark:text-orange-400">
              <IconFlame className="h-4 w-4" />
              Aproveitadas agora
            </h2>
          }
          meta={
            <span className="text-xs font-medium text-orange-600/80 dark:text-orange-500/80">
              {aproveitadasIsFallback
                ? "maiores descontos ativos"
                : "mais clicadas nas últimas 48h"}
            </span>
          }
        >
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:thin]">
            {aproveitadas.map((p) => {
              const d = p.discountPct ?? discountPercent(p.price, p.oldPrice);
              const n = aproveitadasCount.get(p.id) ?? 0;
              return (
                <Link
                  key={p.id}
                  href={`/produto/${p.id}`}
                  className="group flex w-44 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
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
                    {d !== null && (
                      <span className="absolute left-1.5 top-1.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                        -{d}%
                      </span>
                    )}
                    {n > 0 && (
                      <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-orange-500/95 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow">
                        <IconFlame className="h-2.5 w-2.5" />
                        {n}
                      </span>
                    )}
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
                  </div>
                </Link>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {categoryList.length > 0 && (
        <div className="mb-8 mt-4">
          <CategoryNav
            items={[
              {
                slug: "",
                label: "Todas",
                href: qs({ categoria: "", tipo: "" }) + "#catalogo",
                active: !category,
              },
              ...categoryList.map((cat) => ({
                slug: cat,
                label: categoryLabel(cat),
                href: qs({ categoria: cat, tipo: "" }) + "#catalogo",
                active: category === cat,
              })),
            ]}
          />
        </div>
      )}

      <div id="catalogo" className="scroll-mt-20">
      {category && visibleSubs.length > 0 && (
        <nav
          aria-label="Tipos de produto"
          className="mb-5 flex flex-wrap items-center gap-2"
        >
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400">
            Tipo:
          </span>
          <Link
            href={qs({ tipo: "" }) + "#catalogo"}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              !subtype
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-emerald-400"
            }`}
          >
            Todos
          </Link>
          {visibleSubs.map((d) => {
            const count = subtypeCounts.get(d.slug) ?? 0;
            const active = subtype === d.slug;
            return (
              <Link
                key={d.slug}
                href={qs({ tipo: d.slug }) + "#catalogo"}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-emerald-400"
                }`}
              >
                {d.label}
                <span
                  className={`rounded-full px-1.5 py-px text-[10px] font-bold leading-none ${
                    active
                      ? "bg-white/25 text-white"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {count}
                </span>
              </Link>
            );
          })}
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
              <ProductCard key={p.id} product={p} clicks={clickMap.get(p.id)} />
            ))}
          </main>
        </>
      )}
      </div>

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
