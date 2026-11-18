import Link from "next/link";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { maybeSync, maybeSyncML } from "@/lib/syncer";
import ProductCard from "@/components/ProductCard";
import SearchBar from "@/components/SearchBar";
import { categoryLabel, canonicalCategory, CATEGORY_ORDER, rawSlugsFor, subtypesFor } from "@/lib/categories";
import {
  IconCheck,
  IconClock,
  IconFlame,
  IconInstagram,
  IconRefresh,
  IconShield,
  IconZap,
} from "@/components/Icons";
import FeaturedCarousel, {
  type FeaturedItem,
} from "@/components/FeaturedCarousel";
import CountdownTimer from "@/components/CountdownTimer";
import CategoryNav from "@/components/CategoryNav";
import HashLink from "@/components/HashLink";
import CollapsibleSection from "@/components/CollapsibleSection";
import { discountPercent, formatPrice } from "@/lib/format";
import { urgencyLabel } from "@/lib/urgency";
import { FEATURED_STORES, storeLogo } from "@/lib/featured-stores";
import { merchantLogo } from "@/lib/store-logo";
import { Suspense, type ReactNode } from "react";
import type { Product } from "@prisma/client";

export const dynamic = "force-dynamic";

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
  ofertas: {
    label: "Ofertas & Cupons",
    eyebrow: "Cupons & ofertas",
    title: "Ofertas e cupons de hoje",
    noun: "ofertas",
    prefix: "camp:",
    defaultSort: "desconto",
  },
  lojas: {
    label: "Lojas parceiras",
    eyebrow: "Catálogo",
    title: "Produtos das lojas parceiras",
    noun: "produtos",
    prefix: "prod:",
    defaultSort: "recentes",
  },
  ml: {
    label: "Mercado Livre",
    eyebrow: "Mercado Livre",
    title: "Produtos do Mercado Livre",
    noun: "produtos",
    prefix: "ml:",
    defaultSort: "recentes",
  },
  awin: {
    label: "Awin",
    eyebrow: "Awin",
    title: "Ofertas Awin",
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

export async function generateMetadata() {
  return {
    title: "Cupons e ofertas com desconto",
    description:
      "Cupons, ofertas e produtos selecionados das melhores lojas. Ofertas verificadas com links diretos para aproveitar o desconto.",
  };
}

export default async function Home({ searchParams }: PageProps<"/">) {
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
  let tab: Tab = "ofertas";
  if (TAB_ORDER.includes(rawTab as Tab)) tab = rawTab as Tab;
  else if (rawTab === "produtos")
    tab = fonteParam === "awin" ? "awin" : fonteParam === "ml" ? "ml" : "lojas";
  else if (fonteParam === "ml" || fonteParam === "awin") tab = fonteParam;
  const page = Math.max(1, Number(pagina) || 1);
  const merchant = typeof loja === "string" ? loja : "";
  const cfg = TABS[tab];
  const sort: SortKey =
    ordem === "recentes" || ordem === "terminando" || ordem === "populares"
      ? ordem
      : cfg.defaultSort;

  // Esta aba ja define a fonte: todo filtro carrega o prefixo do externalId
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

  // Sync incremental em background: nao bloqueia a resposta
  after(() => {
    maybeSync().catch(() => {});
    maybeSyncML().catch(() => {});
  });

  const FLASH_WINDOW_MS = 48 * 3_600_000;
  const now = new Date();

  const [
    pageItems,
    total,
    categories,
    merchants,
    featured,
    flashDeals,
    aproveitadasTop,
    brandRows,
    orgs,
    subtypeFacets,
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
    // Ofertas em destaque: maiores descontos da fonte ativa
    prisma.product.findMany({
      where: listWhere,
      orderBy: { discountPct: { sort: "desc", nulls: "last" } },
      take: 5,
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
    // "Aproveitadas agora": itens da fonte ativa com cliques recentes,
    // ordenados por total de cliques. Se vier vazio, cai no fallback abaixo.
    prisma.product.findMany({
      where: {
        active: true,
        imageUrl: { not: null },
        AND: [
          sourceCond,
          notZeroPrice,
          notExpired,
          {
            clicks: {
              some: {
                createdAt: { gte: new Date(now.getTime() - 48 * 3_600_000) },
              },
            },
          },
        ],
      },
      orderBy: { clicks: { _count: "desc" } },
      include: { _count: { select: { clicks: true } } },
      take: 12,
    }),
    // Logos das lojas em destaque (Brand.name -> logo Lomadee)
    prisma.brand.findMany({ select: { id: true, name: true, logo: true } }),
    // Lojas afiliadas reais (com logo quando disponivel) para o hero
    prisma.affiliatedOrg.findMany({
      select: { organizationId: true, name: true },
    }),
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
    // Merchants visiveis por fonte em UMA query (FILTER por prefixo) ->
    // aba das "Lojas em destaque" + contagem das abas. Uma query so porque
    // o pool do banco e pequeno (connection_limit baixo).
    prisma.$queryRaw<
      { merchant: string; camp: bigint; prod: bigint; ml: bigint; aw: bigint }[]
    >`
      SELECT "merchant",
        COUNT(*) FILTER (WHERE "externalId" LIKE 'camp:%') AS camp,
        COUNT(*) FILTER (WHERE "externalId" LIKE 'prod:%') AS prod,
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
    ofertas: "camp",
    lojas: "prod",
    ml: "ml",
    awin: "aw",
  };
  const tabCounts = new Map<Tab, number>();
  const countByMerchant = new Map<string, number>();
  const merchantTab = new Map<string, Tab>();
  for (const r of srcRows) {
    const total = Number(r.camp) + Number(r.prod) + Number(r.ml) + Number(r.aw);
    countByMerchant.set(r.merchant, total);
    for (const t of TAB_ORDER) {
      const n = Number(r[SRC_KEY[t]]);
      if (n <= 0) continue;
      tabCounts.set(t, (tabCounts.get(t) ?? 0) + n);
      // primeira fonte que tem a loja define a aba do card (ofertas > lojas > ml > awin)
      if (!merchantTab.has(r.merchant)) merchantTab.set(r.merchant, t);
    }
  }
  // Awin so aparece como aba quando houver itens
  const visibleTabs = TAB_ORDER.filter(
    (t) => t !== "awin" || (tabCounts.get(t) ?? 0) > 0,
  );
  const catalogTotal =
    (tabCounts.get("lojas") ?? 0) +
    (tabCounts.get("ml") ?? 0) +
    (tabCounts.get("awin") ?? 0);
  const offersTotal = tabCounts.get("ofertas") ?? 0;

  // So exibe lojas com itens visiveis; link aponta para a aba da fonte
  const featuredStores = FEATURED_STORES.map((s) => ({
    ...s,
    count: countByMerchant.get(s.merchant) ?? 0,
    tab: (merchantTab.get(s.merchant) ?? null) as Tab | null,
  })).filter((s): s is typeof s & { tab: Tab } => s.tab !== null);

  // heroStores: brands cujo id bate com as orgs afiliadas (sem query extra)
  const orgIds = new Set(orgs.map((o) => o.organizationId));
  const storeNameByOrg = new Map(orgs.map((o) => [o.organizationId, o.name]));
  const heroStores = brandRows
    .filter((b) => orgIds.has(b.id))
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
    return s ? `/?${s}#catalogo` : "/#catalogo";
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

  // "Aproveitadas agora": veio no batch (cliques recentes, fonte da aba).
  // Fallback: sem cliques recentes, mostra os maiores descontos da fonte.
  let aproveitadas: (Product & { _count?: { clicks: number } })[] =
    aproveitadasTop.filter((p) => !flashIds.has(p.id));
  const aproveitadasIsFallback = aproveitadas.length === 0;
  if (!aproveitadas.length) {
    aproveitadas = await prisma.product.findMany({
      where: {
        active: true,
        imageUrl: { not: null },
        discountPct: { gt: 0 },
        AND: [notZeroPrice, notExpired, sourceCond],
      },
      orderBy: { discountPct: "desc" },
      take: 12,
    });
  }
  const featuredItems: FeaturedItem[] = await Promise.all(
    featured.map(async (p) => ({
      id: p.id,
      title: p.title,
      merchant: p.merchant,
      logoUrl: await merchantLogo(p.merchant),
      imageUrl: p.imageUrl,
      priceLabel: formatPrice(p.price, p.currency),
      oldPriceLabel:
        p.oldPrice != null && p.price != null && p.oldPrice > p.price
          ? formatPrice(p.oldPrice, p.currency)
          : null,
      discount: p.discountPct ?? discountPercent(p.price, p.oldPrice),
      urgent: urgencyLabel(p.endsAt),
    })),
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4">
      {/* Hero */}
      <section className="relative -mx-4 mb-8 overflow-hidden rounded-b-[2rem] bg-zinc-950 px-4 pb-10 pt-10 text-white sm:pt-12">
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
              {catalogTotal + offersTotal} ofertas ativas agora
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
                <span className="text-xl font-extrabold text-white">{catalogTotal.toLocaleString("pt-BR")}</span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">produtos</span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col items-center lg:items-start">
                <span className="text-xl font-extrabold text-white">{offersTotal.toLocaleString("pt-BR")}</span>
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
          {/* Abas por fonte de afiliado — catalogo nunca mistura fontes */}
          <nav className="flex max-w-full flex-wrap justify-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur">
            {visibleTabs.map((t) => {
              const count = tabCounts.get(t) ?? 0;
              return (
                <HashLink
                  key={t}
                  href={qs({ aba: t })}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    tab === t
                      ? "bg-white text-zinc-950 shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {TABS[t].label}
                  {count > 0 ? (
                    <span
                      className={`ml-1.5 text-[11px] font-bold ${
                        tab === t ? "text-zinc-500" : "text-zinc-500"
                      }`}
                    >
                      {count.toLocaleString("pt-BR")}
                    </span>
                  ) : null}
                </HashLink>
              );
            })}
          </nav>

          <Suspense>
            <SearchBar merchants={merchantList} currentMerchant={merchant} />
          </Suspense>

          {/* Ordenacao */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
            <span className="mr-1 font-semibold text-zinc-500">Ordenar por</span>
            <div className="flex flex-wrap justify-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
              {(Object.keys(SORTS) as SortKey[]).map((s) => (
                <HashLink
                  key={s}
                  href={qs({ ordem: s })}
                  className={`rounded-full px-3 py-1 font-medium transition-all ${
                    sort === s
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-zinc-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {SORTS[s].label}
                </HashLink>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* Destaques do momento: relampago + mais aproveitadas */}
      {(flashDeals.length > 0 || aproveitadas.length > 0) && (
        <CollapsibleSection
          className="border-zinc-200/80 bg-gradient-to-r from-zinc-50 via-emerald-50/50 to-zinc-50 dark:border-zinc-800 dark:from-zinc-900/60 dark:via-emerald-950/20 dark:to-zinc-900/60"
          title={
            <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
              <IconFlame className="h-4 w-4 text-orange-500" />
              Destaques do momento
            </h2>
          }
          meta={
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {[
                flashDeals.length > 0
                  ? `${flashDeals.length} terminando em breve`
                  : "",
                aproveitadas.length > 0
                  ? `${aproveitadas.length} mais clicadas`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          }
        >
          {flashDeals.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                <IconZap className="h-3.5 w-3.5" />
                Terminando em breve
              </p>
              <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory [scrollbar-width:thin]">
                {flashDeals.map((p) => (
                  <RailCard
                    key={p.id}
                    p={p}
                    className="w-52"
                    corner={
                      p.couponCode ? (
                        <span className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded bg-zinc-900/85 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">
                          {p.couponCode}
                        </span>
                      ) : null
                    }
                    footer={
                      p.endsAt ? (
                        <CountdownTimer endsAt={p.endsAt.toISOString()} />
                      ) : null
                    }
                  />
                ))}
              </div>
            </div>
          )}
          {aproveitadas.length > 0 && (
            <div className={flashDeals.length > 0 ? "mt-5" : ""}>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-orange-600 dark:text-orange-400">
                <IconFlame className="h-3.5 w-3.5" />
                {aproveitadasIsFallback
                  ? "Mais aproveitadas"
                  : "Mais clicadas nas últimas 48h"}
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:thin]">
                {aproveitadas.map((p) => {
                  const n = p._count?.clicks ?? 0;
                  return (
                    <RailCard
                      key={p.id}
                      p={p}
                      className="w-44"
                      corner={
                        n > 0 ? (
                          <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-orange-500/95 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow">
                            <IconFlame className="h-2.5 w-2.5" />
                            {n}
                          </span>
                        ) : null
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* Lojas em destaque: apenas lojas com produtos ativos */}
      {featuredStores.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                Lojas parceiras
              </p>
              <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
                Lojas em destaque
              </h2>
            </div>
            <span className="text-sm font-medium text-zinc-400">
              {featuredStores.length} lojas
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:thin]">
            {featuredStores.map((s) => {
              const logo = storeLogo(s, brandLogoByName);
              return (
                <HashLink
                  key={s.merchant}
                  href={`/?aba=${s.tab}&loja=${encodeURIComponent(s.merchant)}#catalogo`}
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
                  <span className="text-[10px] font-semibold text-zinc-400">
                    {s.count} {s.count === 1 ? "oferta" : "ofertas"}
                  </span>
                </HashLink>
              );
            })}
          </div>
        </section>
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
