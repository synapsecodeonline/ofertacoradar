import { after } from "next/server";
import { Prisma } from "@prisma/client";
import type { Product } from "@prisma/client";
import { prisma } from "@/lib/db";
import { maybeSyncLomadee, maybeSyncML } from "@/lib/syncer";
import { maybeSyncAwin } from "@/lib/awin";
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
import { Suspense } from "react";

const PAGE_SIZE = 48;

// Esconde itens com preco zerado (R$0,00) e ofertas expiradas
const notZeroPrice = {
  OR: [{ price: null }, { price: { not: 0 } }],
};
const notExpired = {
  OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
};

// Duas abas: "Produtos" = catalogo unificado de produtos e ofertas de
// TODAS as fontes (ranking por desconto); "Cupons" = todo item de
// cupom/oferta (couponCode ou campanha Lomadee), de qualquer fonte.
const TABS = {
  produtos: {
    label: "Produtos",
    eyebrow: "Lomadee · Mercado Livre · Amazon",
    title: "As melhores ofertas do Brasil",
    noun: "ofertas",
  },
  cupons: {
    label: "Cupons",
    eyebrow: "Cupons de desconto",
    title: "Cupom certo, preço menor",
    noun: "cupons",
  },
} as const;
type Tab = keyof typeof TABS;

// Ordenacoes da aba Produtos: "ofertas" (default) = intercalado por fonte;
// as demais usam Prisma com orderBy direto (sem interleave).
const ORDENS = {
  desconto: { discountPct: { sort: "desc", nulls: "last" } },
  recentes: { createdAt: "desc" },
  "menor-preco": { price: { sort: "asc", nulls: "last" } },
  "maior-preco": { price: { sort: "desc", nulls: "last" } },
} as const;
type Ordem = keyof typeof ORDENS;

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
  const { q, categoria, aba, pagina, loja, tipo, ordem: ordemParam } =
    await searchParams;
  const query = typeof q === "string" ? q : "";
  const rawCat = typeof categoria === "string" ? categoria : "";
  const category = rawCat ? canonicalCategory(rawCat) : "";
  const rawSub = typeof tipo === "string" ? tipo : "";
  const subDefs = subtypesFor(category);
  const subtype = subDefs.some((d) => d.slug === rawSub) ? rawSub : "";
  const rawTab = typeof aba === "string" ? aba : "";
  // Legado: ?aba=lomadee|ml|awin|amazon|produtos|ofertas|lojas e ?fonte=
  // convergem para a aba Produtos — as URLs antigas caem na visao
  // unificada em vez de 404. So "cupons" e aba propria.
  const tab: Tab = rawTab === "cupons" ? "cupons" : "produtos";
  const isCouponTab = tab === "cupons";
  const page = Math.max(1, Number(pagina) || 1);
  const merchant = typeof loja === "string" ? loja : "";
  const ordemRaw = typeof ordemParam === "string" ? ordemParam : "";
  const ordem: Ordem | "" = ordemRaw in ORDENS ? (ordemRaw as Ordem) : "";
  const cfg = TABS[tab];

  // Produtos: tudo que e item de afiliado vendavel, de todas as fontes,
  // num ranking so. Cupons: todo item de cupom/oferta — couponCode de
  // qualquer fonte + campanhas Lomadee camp- (ofertas com ou sem codigo).
  const sourceCond = isCouponTab
    ? {
        OR: [
          { couponCode: { not: "" } },
          { externalId: { startsWith: "camp-lomadee:" } },
        ],
      }
    : {
        OR: [
          { externalId: { startsWith: "prod-lomadee:" } },
          { externalId: { startsWith: "camp-lomadee:" } },
          { externalId: { startsWith: "ml:" } },
          { externalId: { startsWith: "aw:" } },
          { externalId: { startsWith: "amz:" } },
        ],
      };
  const searchFilter = query
    ? {
        OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
          { merchant: { contains: query, mode: "insensitive" as const } },
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

  // Aba Produtos: intercala as fontes — ROW_NUMBER por fonte (ordem por
  // desconto) e merge por rodada (rn). Fontes pequenas (Amazon/Awin)
  // aparecem em toda pagina em vez de afundar no ranking global.
  // Cupons mantem a ordenacao por expiracao via Prisma.
  const interleaveConds: Prisma.Sql[] = [
    Prisma.sql`active = true`,
    Prisma.sql`("price" IS NULL OR "price" <> 0)`,
    Prisma.sql`("endsAt" IS NULL OR "endsAt" >= now())`,
    Prisma.sql`"imageUrl" IS NOT NULL`,
    Prisma.sql`(
      "externalId" LIKE 'prod-lomadee:%' OR "externalId" LIKE 'camp-lomadee:%'
      OR "externalId" LIKE 'ml:%' OR "externalId" LIKE 'aw:%' OR "externalId" LIKE 'amz:%'
    )`,
    ...(category
      ? [Prisma.sql`"category" IN (${Prisma.join(rawSlugsFor(category))})`]
      : []),
    ...(category && subtype ? [Prisma.sql`"subtype" = ${subtype}`] : []),
    ...(merchant
      ? [Prisma.sql`LOWER("merchant") = LOWER(${merchant})`]
      : []),
    ...(query
      ? [
          Prisma.sql`(
            "title" ILIKE ${`%${query}%`} OR "description" ILIKE ${`%${query}%`}
            OR "merchant" ILIKE ${`%${query}%`}
          )`,
        ]
      : []),
  ];

  // Sync incremental em background: nao bloqueia a resposta.
  // Retornar a promise e obrigatorio: sem isso o after() resolve na
  // hora e a function congela apos a resposta, matando o sync.
  after(() =>
    Promise.all([
      maybeSyncLomadee().catch(() => {}),
      maybeSyncML().catch(() => {}),
      maybeSyncAwin().catch(() => {}),
    ]),
  );

  const FLASH_WINDOW_MS = 48 * 3_600_000;
  const now = new Date();

  const [
    pageItems,
    total,
    categories,
    merchants,
    flashDeals,
    subtypeFacets,
    couponTotal,
    srcRows,
  ] = await Promise.all([
    isCouponTab || ordem
      ? prisma.product.findMany({
          where: listWhere,
          // Cupons: os que terminam antes primeiro. Ordem escolhida:
          // desconto / recentes / menor / maior preco.
          orderBy: isCouponTab
            ? [
                { endsAt: { sort: "asc", nulls: "last" } },
                { id: "desc" as const },
              ]
            : ordem
              ? ORDENS[ordem]
              : { discountPct: { sort: "desc", nulls: "last" } },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        })
      : // Produtos: intercalado por fonte — ver interleaveConds acima.
        prisma.$queryRaw<Product[]>`
          WITH filtered AS (
            SELECT p.*,
              CASE
                WHEN p."externalId" LIKE 'prod-lomadee:%' THEN 0
                WHEN p."externalId" LIKE 'camp-lomadee:%' THEN 1
                WHEN p."externalId" LIKE 'ml:%' THEN 2
                WHEN p."externalId" LIKE 'aw:%' THEN 3
                WHEN p."externalId" LIKE 'amz:%' THEN 4
                ELSE 5
              END AS src
            FROM "ofertacoradar"."Product" p
            WHERE ${Prisma.join(interleaveConds, " AND ")}
          ),
          ranked AS (
            SELECT *, ROW_NUMBER() OVER (
              PARTITION BY src
              ORDER BY "discountPct" DESC NULLS LAST, id DESC
            ) - 1 AS rn
            FROM filtered
          )
          SELECT * FROM ranked
          ORDER BY rn, "discountPct" DESC NULLS LAST, id DESC
          LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
        `,
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
    // Total de cupons/ofertas do catalogo inteiro (sem filtros) p/ o cabecalho
    prisma.product.count({
      where: {
        active: true,
        imageUrl: { not: null },
        OR: [
          { couponCode: { not: "" } },
          { externalId: { startsWith: "camp-lomadee:" } },
        ],
        AND: [notExpired],
      },
    }),
    // Merchants visiveis por fonte em UMA query (FILTER por prefixo) ->
    // secao "Lojas em destaque" + total do catalogo de produtos.
    // Uma query so porque o pool do banco e pequeno (connection_limit baixo).
    prisma.$queryRaw<
      { merchant: string; camp: bigint; prod: bigint; ml: bigint; aw: bigint; amz: bigint }[]
    >`
      SELECT "merchant",
        COUNT(*) FILTER (WHERE "externalId" LIKE 'camp-lomadee:%') AS camp,
        COUNT(*) FILTER (WHERE "externalId" LIKE 'prod-lomadee:%') AS prod,
        COUNT(*) FILTER (WHERE "externalId" LIKE 'ml:%')   AS ml,
        COUNT(*) FILTER (WHERE "externalId" LIKE 'aw:%')   AS aw,
        COUNT(*) FILTER (WHERE "externalId" LIKE 'amz:%')  AS amz
      FROM "ofertacoradar"."Product"
      WHERE active
        AND "merchant" IS NOT NULL
        AND "imageUrl" IS NOT NULL
        AND ("price" IS NULL OR "price" <> 0)
        AND ("endsAt" IS NULL OR "endsAt" >= now())
      GROUP BY "merchant"
    `,
  ]);

  // srcRows: uma linha por merchant com contagem por prefixo de fonte —
  // alimenta o total do catalogo de produtos.
  let catalogTotal = 0;
  for (const r of srcRows) {
    catalogTotal +=
      Number(r.camp) +
      Number(r.prod) +
      Number(r.ml) +
      Number(r.aw) +
      Number(r.amz);
  }
  const headerTotal = isCouponTab ? couponTotal : catalogTotal;


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
    if (ordem) p.set("ordem", ordem);
    // Produtos e a aba padrao — so grava ?aba= na aba Cupons
    if (isCouponTab) p.set("aba", "cupons");
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


  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4">
      {/* Cabecalho da visao de catalogo: titulo da fonte + busca */}
      {!dayOnly && (
        <section className="-mx-4 mb-5 rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-teal-50/60 to-white px-4 py-4 sm:mb-8 sm:px-5 sm:py-8 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-teal-950/10 dark:to-zinc-900">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 text-center sm:gap-6">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 sm:text-[11px]">
                {cfg.eyebrow}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:mt-1.5 sm:text-3xl lg:text-4xl">
                {cfg.title}
              </h1>
              <p className="mt-1 hidden text-sm text-zinc-500 dark:text-zinc-400 sm:mt-2 sm:block">
                {headerTotal.toLocaleString("pt-BR")} {cfg.noun} conferidas ·
                preço e estoque atualizados todo dia
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

      {/* Ordenacao fixa por aba: Produtos ranqueia por desconto,
          Cupons pelos que terminam antes. */}
      {isCouponTab && (
        <p className="mb-5 text-center text-xs font-semibold text-zinc-400">
          Ordenados pelos cupons que terminam primeiro
        </p>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-lg font-bold text-zinc-700 dark:text-zinc-200">
            Nada por aqui ainda
          </p>
          <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            {isCouponTab
              ? "Nenhum cupom ativo no momento. Volte em breve — novos códigos aparecem todo dia."
              : `Nenhum item encontrado com esses filtros. Tente outra busca ou volte mais tarde — o catálogo é atualizado diariamente.`}
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
            </div>
            <span aria-live="polite" className="text-sm font-medium text-zinc-500">
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
