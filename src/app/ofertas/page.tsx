import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/db";
import ProductCard from "@/components/ProductCard";
import { CATEGORY_ORDER, categoryLabel, canonicalCategory } from "@/lib/categories";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Ofertas verificadas | ${SITE_NAME}`,
  description: SITE_TAGLINE,
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

const LINKS = [
  {
    href: "/#catalogo",
    icon: "🔥",
    title: "Ofertas em destaque",
    sub: "As melhores de agora",
  },
  {
    href: "/?ordem=desconto#catalogo",
    icon: "🏷️",
    title: "Maiores descontos",
    sub: "Até 90% off todo dia",
  },
  {
    href: "/ofertas#terminando",
    icon: "⏰",
    title: "Terminando hoje",
    sub: "Corre que acaba",
  },
  {
    href: "/?aba=cupons",
    icon: "🎟️",
    title: "Cupons de desconto",
    sub: "Cupom certo, preço menor",
  },
  {
    href: "/?ordem=recentes#catalogo",
    icon: "🆕",
    title: "Chegaram agora",
    sub: "Lançamentos fresquinhos",
  },
  {
    href: "/ofertas#categorias",
    icon: "📂",
    title: "Ver por categoria",
    sub: "Mercado, tech, casa e mais",
  },
];

function timeAgo(d: Date): string {
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 90) return "agora mesmo";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export default async function OfertasPage() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3_600_000);
  const [products, total, endingSoon, syncStates] = await Promise.all([
    prisma.product.findMany({
      where: WHERE,
      orderBy: [{ discountPct: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      take: 8,
    }),
    prisma.product.count({ where: WHERE }),
    prisma.product.findMany({
      where: {
        ...WHERE,
        endsAt: { gte: now, lte: in24h },
      },
      orderBy: [{ endsAt: "asc" }, { discountPct: { sort: "desc", nulls: "last" } }],
      take: 4,
    }),
    prisma.syncState.findMany({
      where: { key: { in: ["main", "ml", "amazon"] } },
      select: { lastCycleAt: true },
    }),
  ]);

  const lastSync = syncStates
    .map((s) => s.lastCycleAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10">
      {/* ===== Perfil + links (estilo Linktree) ===== */}
      <section className="mx-auto flex w-full max-w-md flex-col items-center pt-8 text-center">
        <div className="rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 p-[3px] shadow-lg shadow-emerald-600/25">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-4xl">
            🛸
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
          {SITE_NAME}
        </h1>
        <p className="mt-0.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          @ofertacoradar
        </p>
        <p className="mt-2 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
          {SITE_TAGLINE} —{" "}
          <b className="text-zinc-700 dark:text-zinc-200">
            {total.toLocaleString("pt-BR")} ofertas
          </b>{" "}
          conferidas todo dia.
        </p>

        {/* Prova social: numeros ao vivo */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold">
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            🔥 {total.toLocaleString("pt-BR")} ofertas ativas
          </span>
          {lastSync && (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              🔄 catálogo atualizado {timeAgo(lastSync)}
            </span>
          )}
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            ✓ preços e cupons verificados
          </span>
        </div>

        {/* Links */}
        <nav aria-label="Links rápidos" className="mt-6 flex w-full flex-col gap-2.5">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group flex items-center gap-4 rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-600/10 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-700"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xl transition-colors group-hover:bg-emerald-50 dark:bg-zinc-800 dark:group-hover:bg-emerald-950/50">
                {l.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold text-zinc-900 dark:text-white">
                  {l.title}
                </span>
                <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {l.sub}
                </span>
              </span>
              <span className="text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-500 dark:text-zinc-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </span>
            </Link>
          ))}
        </nav>

        {/* Social */}
        <a
          href="https://instagram.com/ofertacoradar"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-4 py-2 text-xs font-bold text-pink-600 transition-colors hover:bg-pink-100 dark:border-pink-900 dark:bg-pink-950/40 dark:text-pink-400"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
          Seguir @ofertacoradar
        </a>
      </section>

      {/* ===== Terminando hoje (urgencia real) ===== */}
      {endingSoon.length > 0 && (
        <section id="terminando" className="mx-auto mt-10 w-full max-w-3xl scroll-mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              ⏰ Terminando nas próximas 24h
            </h2>
            <Link
              href="/?ordem=terminando#catalogo"
              className="text-xs font-bold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Ver todos →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {endingSoon.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ===== Categorias ===== */}
      <section id="categorias" className="mx-auto mt-10 w-full max-w-3xl scroll-mt-6">
        <h2 className="mb-3 text-center text-sm font-extrabold uppercase tracking-widest text-zinc-500">
          Ou explore por categoria
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {CATEGORY_ORDER.map((c) => (
            <Link
              key={c}
              href={`/?categoria=${encodeURIComponent(canonicalCategory(c))}`}
              className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:border-emerald-400 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-emerald-400"
            >
              {categoryLabel(c)}
            </Link>
          ))}
        </div>
      </section>

      {/* ===== Ofertas em destaque ===== */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-zinc-500">
            🏆 Ofertas em destaque
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
          {SITE_NAME} — {SITE_TAGLINE.toLowerCase()}. Links de parceiro, sem
          custo extra pra você.
        </p>
      </footer>
    </div>
  );
}
