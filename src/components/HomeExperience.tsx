import Link from "next/link";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { maybeSyncLomadee, maybeSyncML } from "@/lib/syncer";
import ProductCard from "@/components/ProductCard";
import SearchBar from "@/components/SearchBar";
import { categoryLabel, canonicalCategory, CATEGORY_ORDER, rawSlugsFor, subtypesFor } from "@/lib/categories";
import {
  IconCheck,
  IconClock,
  IconInstagram,
  IconRefresh,
  IconShield,
} from "@/components/Icons";
import CategoryNav from "@/components/CategoryNav";
import HashLink from "@/components/HashLink";
import CatalogScrollOnNav from "@/components/CatalogScrollOnNav";
import CollapsibleSection from "@/components/CollapsibleSection";
import { discountPercent, formatPrice } from "@/lib/format";
import { FEATURED_STORES, storeLogo } from "@/lib/featured-stores";
import { Suspense, type ReactNode } from "react";
import type { Product } from "@prisma/client";

const PAGE_SIZE = 48;

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

// Cada aba e uma fonte de afiliado: o catalogo nunca mistura fontes.
// prefix = externalId prefix; noun = rotulo de contagem; sort default.
const TABS = {
  lomadee: {
    label: "Lojas Lomadee",
    eyebrow: "Lomadee",
    title: "Produtos Lomadee",
    noun: "produtos",
    prefix: "prod-lomadee:",
    defaultSort: "recentes",
  },
  ml: {
    label: "Lojas Mercado Livre",
    eyebrow: "Mercado Livre",
    title: "Produtos Mercado Livre",
    noun: "produtos",
    prefix: "ml:",
    defaultSort: "recentes",
  },
  awin: {
    label: "Awin",
    eyebrow: "Awin",
    title: "Produtos Awin",
    noun: "produtos",
    prefix: "aw:",
    defaultSort: "recentes",
  },
} as const;
type Tab = keyof typeof TABS;
const TAB_ORDER = Object.keys(TABS) as Tab[];

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

function RailCard({
  p,
  className = "w-48",
  corner,
  footer,
}: {
  p: Product;
  className?: string;
  corner?: ReactNode;
  footer?: ReactNode;
}) {
  const d = p.discountPct ?? discountPercent(p.price, p.oldPrice);
  const saving =
    p.price != null && p.oldPrice != null && p.oldPrice > p.price
      ? p.oldPrice - p.price
      : null;
  return (
    <Link
      href={`/produto/${p.id}`}
      className={`group flex ${className} shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900`}
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
        {corner}
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
        {footer}
      </div>
    </Link>
  );
}

type SearchParams = Promise<{
  [key: string]: string | string[] | undefined;
}>;

export async function HomeExperience({
  searchParams,
  dayOnly = false,
}: {
  searchParams: SearchParams;
  // dayOnly: renderiza so Instagram + transparencia (tela "Ofertas do dia")
  dayOnly?: boolean;
}) {
  const { q, categoria, aba, pagina, ordem, loja, tipo, fonte: fonteRaw } =
    await searchParams;
  const query = typeof q === "string" ? q : "";
  const rawCat = typeof categoria === "string" ? categoria : "";
  const category = rawCat ? canonicalCategory(rawCat) : "";
  const rawSub = typeof tipo === "string" ? tipo : "";
  const subDefs = subtypesFor(category);
  const subtype = subDefs.some((d) => d.slug === rawSub) ? rawSub : "";
  const rawTab = typeof aba === "string" ? aba : "";
  const fonteParam = typeof fonteRaw === "string" ? fonteRaw : "";
  // Legado: aba=produtos (catalogo unificado) e ?fonte= migram p/ a aba da fonte
  // "lojas"/"produtos"/"ofertas" sao legados -> aba canonica e lomadee
  let tab: Tab = "lomadee";
  if (TAB_ORDER.includes(rawTab as Tab)) tab = rawTab as Tab;
  else if (rawTab === "produtos" || rawTab === "ofertas" || rawTab === "lojas")
    tab = fonteParam === "awin" ? "awin" : fonteParam === "ml" ? "ml" : "lomadee";
  else if (fonteParam === "ml" || fonteParam === "awin" || fonteParam === "lomadee") tab = fonteParam === "lomadee" ? "lomadee" : fonteParam;
  const page = Math.max(1, Number(pagina) || 1);
  const merchant = typeof loja === "string" ? loja : "";
  const cfg = TABS[tab];
  const sort: SortKey =
    ordem === "recentes" || ordem === "terminando" || ordem === "populares"
      ? ordem
      : cfg.defaultSort;

  // Cada aba filtra um unico prefixo de fonte — nada de misturar.
  const sourceCond = { externalId: { startsWith: cfg.prefix } };
  const searchFilter = query
    ? {
        OR: [
          { title: { contains: query } },
          { description: { contains: query } },
          { merchant: { contains: query } },
        ],
      }
    : {};
  const listWhere = {
    active: true,
    AND: [
      sourceCond,
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
  };

  // Secao "Ofertas {Fonte}": Lomadee usa camp: (ofertas/cupons);
  // ML/Awin usam os itens com desconto da propria fonte.
  const OFFERS_PREFIX: Record<Tab, string> = {
    lomadee: "camp-lomadee:",
    ml: "ml:",
    awin: "aw:",
  };
  const OFFERS_TITLE: Record<Tab, string> = {
    lomadee: "Ofertas Lomadee",
    ml: "Ofertas Mercado Livre",
    awin: "Ofertas Awin",
  };
  const STORE_EYEBROW: Record<Tab, string> = {
    lomadee: "Lojas Lomadee",
    ml: "Lojas Mercado Livre",
    awin: "Lojas Awin",
  };
  const offersWhere = {
    ...listWhere,
    AND: [
      { externalId: { startsWith: OFFERS_PREFIX[tab] } },
      ...listWhere.AND.filter((c) => c !== sourceCond),
      ...(tab === "lomadee" ? [] : [{ discountPct: { gt: 0 } }]),
    ],
  };

  // Sync incremental em background: nao bloqueia a resposta
  after(() => {
    maybeSyncLomadee().catch(() => {});
    maybeSyncML().catch(() => {});
  });

  const FLASH_WINDOW_MS = 48 * 3_600_000;
  const now = new Date();

  const [
    pageItems,
    total,
    categories,
    merchants,
    flashDeals,
    brandRows,
    subtypeFacets,
    offersItems,
    srcRows,
  ] = await Promise.all([
    prisma.product.findMany({
      where: listWhere,
      orderBy: orderByFor(sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.product.count({ where: listWhere }),
    prisma.product.findMany({
      where: {
        active: true,
        category: { not: null },
        AND: [
          sourceCond,
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
          sourceCond,
          notZeroPrice,
          notExpired,
          { imageUrl: { not: null } },
        ],
      },
      select: { merchant: true },
      distinct: ["merchant"],
    }),
    // Relampago: terminam nas proximas 48h, mais urgentes primeiro.
    // Escopo da fonte ativa; respeita busca/categoria/loja.
    prisma.product.findMany({
      where: {
        active: true,
        AND: [
          sourceCond,
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

    // Logos das lojas em destaque (Brand.name -> logo Lomadee)
    prisma.brand.findMany({ select: { id: true, name: true, logo: true } }),
    // Contagem por subtipo dentro da categoria ativa (mesmos filtros da lista)
    subDefs.length
      ? prisma.product.groupBy({
          by: ["subtype"],
          where: {
            active: true,
            subtype: { not: null },
            AND: [
              sourceCond,
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
        })
      : Promise.resolve([]),
    // Secao de ofertas da fonte (camp-lomadee: na Lomadee; desconto em ML/Awin)
    prisma.product.findMany({
      where: offersWhere,
      orderBy:
        tab === "lomadee"
          ? { endsAt: { sort: "asc", nulls: "last" } }
          : { discountPct: { sort: "desc", nulls: "last" } },
      take: 12,
    }),
    // Merchants visiveis por fonte em UMA query (FILTER por prefixo) ->
    // aba das "Lojas em destaque" + contagem das abas. Uma query so porque
    // o pool do banco e pequeno (connection_limit baixo).
    prisma.$queryRaw<
      { merchant: string; camp: bigint; prod: bigint; ml: bigint; aw: bigint }[]
    >`
      SELECT "merchant",
        COUNT(*) FILTER (WHERE "externalId" LIKE 'camp-lomadee:%') AS camp,
        COUNT(*) FILTER (WHERE "externalId" LIKE 'prod-lomadee:%') AS prod,
        COUNT(*) FILTER (WHERE "externalId" LIKE 'ml:%')   AS ml,
        COUNT(*) FILTER (WHERE "externalId" LIKE 'aw:%')   AS aw
      FROM "Product"
      WHERE active
        AND "merchant" IS NOT NULL
        AND "imageUrl" IS NOT NULL
        AND ("price" IS NULL OR "price" <> 0)
        AND ("endsAt" IS NULL OR "endsAt" >= now())
      GROUP BY "merchant"
    `,
  ]);

  // Mapa nome da marca -> logo p/ secao "Lojas em destaque"
  const brandLogoByName = new Map(
    brandRows.map((b) => [b.name ?? "", b.logo] as const),
  );

  // Contagem de itens visiveis por fonte (abas) e por loja.
  // srcRows: uma linha por merchant com contagem por prefixo de fonte.
  const SRC_KEY: Record<Tab, "camp" | "prod" | "ml" | "aw"> = {
    lomadee: "prod",
    ml: "ml",
    awin: "aw",
  };
  const tabCounts = new Map<Tab, number>();
  const countByMerchant = new Map<string, number>();
  const merchantSrc = new Map<
    string,
    { camp: number; prod: number; ml: number; aw: number }
  >();
  for (const r of srcRows) {
    const camp = Number(r.camp);
    const prod = Number(r.prod);
    const ml = Number(r.ml);
    const aw = Number(r.aw);
    const total = camp + prod + ml + aw;
    countByMerchant.set(r.merchant, total);
    merchantSrc.set(r.merchant, { camp, prod, ml, aw });
    for (const t of TAB_ORDER) {
      const n = { camp, prod, ml, aw }[SRC_KEY[t]];
      if (n <= 0) continue;
      tabCounts.set(t, (tabCounts.get(t) ?? 0) + n);
    }
  }
  // Awin so aparece como aba quando houver itens
  const catalogTotal =
    (tabCounts.get("lomadee") ?? 0) +
    (tabCounts.get("ml") ?? 0) +
    (tabCounts.get("awin") ?? 0);

  // "Lojas em destaque" por aba. Lomadee = rede inteira (camp+prod),
  // ML = ml:, Awin = aw: — cada tela so mostra lojas da sua fonte.
  const SRC_COUNT: Record<Tab, "camp" | "prod" | "ml" | "aw"> = {
    lomadee: "prod",
    ml: "ml",
    awin: "aw",
  };
  const featuredForTab = (t: Tab) =>
    FEATURED_STORES.map((s) => {
      const src = merchantSrc.get(s.merchant);
      const counts = src ?? { camp: 0, prod: 0, ml: 0, aw: 0 };
      // Lojas Lomadee inclui ofertas camp: + produtos prod-lomadee: da rede Lomadee
      const visible =
        t === "lomadee"
          ? counts.camp + counts.prod > 0
          : (src ? src[SRC_COUNT[t]] : 0) > 0;
      return {
        ...s,
        offers: counts.camp,
        products: counts.prod + counts.ml + counts.aw,
        linkTab: t,
        visible,
      };
    }).filter((s) => s.visible);
  const featuredStores = featuredForTab(tab);


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

  // Contagem por subtipo dentro da categoria ativa (veio no batch)
  const subtypeCounts = new Map<string, number>();
  for (const f of subtypeFacets) {
    if (f.subtype) subtypeCounts.set(f.subtype, f._count._all);
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
    const defaultSort = cfg.defaultSort;
    if (sort !== defaultSort) p.set("ordem", sort);
    for (const [k, v] of Object.entries(extra)) {
      if (v === "") p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    // Toda mudanca de filtro leva a altura do catalogo (HashLink cuida do scroll)
    return s ? `/ofertas-do-dia?${s}#catalogo` : "/ofertas-do-dia#catalogo";
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasNextPage = page < totalPages;
  const flashIds = new Set(flashDeals.map((p) => p.id));
  const items = pageItems.filter((p) => !flashIds.has(p.id));

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


  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4">
      {/* Cabecalho da visao de catalogo: titulo da fonte + busca */}
      {!dayOnly && (
        <section className="-mx-4 mb-8 rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white px-5 py-8 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-teal-950/10 dark:to-zinc-900">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 text-center">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                {cfg.eyebrow}
              </p>
              <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
                {cfg.title}
              </h1>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {catalogTotal.toLocaleString("pt-BR")} {cfg.noun} verificadas ·
                preços e ofertas atualizados diariamente
              </p>
            </div>
            <div className="w-full max-w-2xl">
              <Suspense>
                <CatalogScrollOnNav />
                <SearchBar
                  merchants={merchantList}
                  currentMerchant={merchant}
                />
              </Suspense>
            </div>
          </div>
        </section>
      )}

      {!dayOnly && (<>
      {/* Ofertas da fonte: camp-lomadee: na Lomadee; desconto em ML/Awin */}
      {offersItems.length > 0 && (
        <CollapsibleSection
          defaultOpen={false}
          className="mb-8 border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20"
          title={
            <span className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                Ofertas verificadas
              </span>
              <span className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
                {OFFERS_TITLE[tab]}
              </span>
            </span>
          }
          meta={
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {offersItems.length} ofertas
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {offersItems.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Lojas em destaque: apenas lojas com produtos ativos */}
      {featuredStores.length > 0 && (
        <CollapsibleSection
          defaultOpen={false}
          className="mb-8"
          title={
            <span className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                {STORE_EYEBROW[tab]}
              </span>
              <span className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
                Lojas em destaque
              </span>
            </span>
          }
          meta={
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {featuredStores.length} lojas
            </span>
          }
        >
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:thin]">
            {featuredStores.map((s) => {
              const logo = storeLogo(s, brandLogoByName);
              return (
                <HashLink
                  key={s.merchant}
                  href={`/ofertas-do-dia?aba=${s.linkTab}&loja=${encodeURIComponent(s.merchant)}#catalogo`}
                  className="group flex w-32 shrink-0 snap-start flex-col items-center gap-2.5 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700"
                >
                  <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-zinc-50 dark:bg-zinc-950">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logo}
                        alt={s.merchant}
                        className="h-full w-full object-contain p-1.5"
                      />
                    ) : (
                      <span className="text-lg font-extrabold text-zinc-300 dark:text-zinc-600">
                        {s.merchant.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-center text-xs font-bold leading-tight text-zinc-700 transition-colors group-hover:text-emerald-700 dark:text-zinc-300 dark:group-hover:text-emerald-400">
                    {s.merchant}
                  </span>
                  <span className="text-center text-[10px] font-semibold leading-tight text-zinc-400">
                    {[
                      s.offers > 0
                        ? `${s.offers} ${s.offers === 1 ? "oferta" : "ofertas"}`
                        : "",
                      s.products > 0
                        ? `${s.products} ${s.products === 1 ? "produto" : "produtos"}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </HashLink>
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
                href: qs({ categoria: "", tipo: "" }),
                active: !category,
              },
              ...categoryList.map((cat) => ({
                slug: cat,
                label: categoryLabel(cat),
                href: qs({ categoria: cat, tipo: "" }),
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
          <HashLink
            href={qs({ tipo: "" })}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              !subtype
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-emerald-400"
            }`}
          >
            Todos
          </HashLink>
          {visibleSubs.map((d) => {
            const count = subtypeCounts.get(d.slug) ?? 0;
            const active = subtype === d.slug;
            return (
              <HashLink
                key={d.slug}
                href={qs({ tipo: d.slug })}
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
              </HashLink>
            );
          })}
        </nav>
      )}

      {/* Ordenacao: entre categorias e catalogo */}
      <div className="mb-5 flex flex-wrap items-center justify-center gap-1.5 text-xs">
        <span className="mr-1 font-semibold text-zinc-500 dark:text-zinc-400">
          Ordenar por
        </span>
        <div className="flex flex-wrap justify-center gap-1 rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
          {(Object.keys(SORTS) as SortKey[]).map((s) => (
            <HashLink
              key={s}
              href={qs({ ordem: s })}
              className={`rounded-full px-3 py-1 font-medium transition-all ${
                sort === s
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {SORTS[s].label}
            </HashLink>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-lg font-bold text-zinc-700 dark:text-zinc-200">
            Nada por aqui ainda
          </p>
          <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            {tab === "awin"
              ? "Awin ainda não tem ofertas ativas. Assim que uma loja parceira for aprovada, os produtos aparecem aqui automaticamente."
              : `Nenhum item encontrado em ${cfg.label} com esses filtros. Tente outra busca ou volte mais tarde — o catálogo é atualizado diariamente.`}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                {cfg.eyebrow}
              </p>
              <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
                {cfg.title}
              </h2>
              <Link
                href="/ofertas-do-dia"
                className="mt-0.5 text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
              >
                Ver ofertas do dia →
              </Link>
            </div>
            <span className="text-sm font-medium text-zinc-400">
              {items.length}
              {total > items.length ? ` de ${total.toLocaleString("pt-BR")}` : ""}{" "}
              {cfg.noun}
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

      {(page > 1 || hasNextPage) && (
        <nav className="flex items-center justify-center gap-4 pb-8 text-sm">
          {page > 1 && (
            <HashLink
              href={qs({ pagina: String(page - 1) })}
              className="rounded-full bg-white px-4 py-2 font-medium shadow-sm hover:bg-zinc-100 dark:bg-zinc-900"
            >
              ← Anterior
            </HashLink>
          )}
          <span className="text-zinc-500">
            Página {page} de {totalPages}
          </span>
          {hasNextPage && (
            <HashLink
              href={qs({ pagina: String(page + 1) })}
              className="rounded-full bg-white px-4 py-2 font-medium shadow-sm hover:bg-zinc-100 dark:bg-zinc-900"
            >
              Próxima →
            </HashLink>
          )}
        </nav>
      )}

      </>)}

      {/* Instagram: ofertas do dia em video */}
      <section className="relative mb-10 -mx-4 overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-600 via-rose-500 to-orange-400 px-6 py-10 text-white shadow-lg">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl"
        />
        <div className="relative flex flex-col items-center gap-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest backdrop-blur">
              <IconInstagram className="h-3.5 w-3.5" /> Novidades primeiro no Instagram
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Ofertas do dia em vídeo, antes de todo mundo
            </h2>
            <p className="max-w-md text-sm text-white/85">
              A gente caça os maiores descontos e posta no Instagram em tempo
              real. Siga para não perder nenhuma.
            </p>
          </div>
          <a
            href={
              process.env.NEXT_PUBLIC_INSTAGRAM_URL ??
              "https://instagram.com/ofertacoradar"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-white px-6 text-sm font-extrabold text-fuchsia-700 shadow-lg transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            <IconInstagram className="h-5 w-5" />
            Seguir no Instagram
          </a>
        </div>
      </section>

      {/* Transparência: por que confiar no Radar */}
      <section className="mb-10">
        <div className="mb-4 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            Transparência total
          </p>
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
            Por que confiar no Ofertaço Radar
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: <IconRefresh className="h-5 w-5 text-emerald-600" />,
              title: "Preços atualizados",
              text: "Sincronizamos os preços direto nas lojas parceiras — o valor que você vê é o que está valendo agora.",
            },
            {
              icon: <IconShield className="h-5 w-5 text-emerald-600" />,
              title: "Compra na loja oficial",
              text: "Você finaliza a compra no site da própria loja (Mercado Livre, Amazon etc). Nunca pedimos seus dados.",
            },
            {
              icon: <IconCheck className="h-5 w-5 text-emerald-600" />,
              title: "Só ofertas reais",
              text: "Filtramos itens sem estoque, preço zerado e promoções encerradas. Se não está no ar, não aparece.",
            },
            {
              icon: <IconClock className="h-5 w-5 text-emerald-600" />,
              title: "Aviso de afiliado",
              text: "Nossos links são de parceiro: podemos receber comissão pela compra, sem custo extra para você.",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="flex flex-col gap-2 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                {c.icon}
              </span>
              <h3 className="text-sm font-extrabold">{c.title}</h3>
              <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {c.text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
