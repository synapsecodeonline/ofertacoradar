import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { SOURCE_LABEL, SOURCE_BADGE, type SourceKey } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const DAY_MS = 86_400_000;

function sourceSql(col: string) {
  return `CASE
    WHEN ${col} LIKE 'camp-lomadee:%' OR ${col} LIKE 'prod-lomadee:%' THEN 'lomadee'
    WHEN ${col} LIKE 'ml:%' THEN 'ml'
    WHEN ${col} LIKE 'aw:%' THEN 'awin'
    ELSE 'outros' END`;
}

function BarChart({
  data,
  labels,
}: {
  data: number[];
  labels: string[];
}) {
  const max = Math.max(1, ...data);
  const W = 720;
  const H = 180;
  const pad = 8;
  const bw = (W - pad * 2) / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full">
      {data.map((v, i) => {
        const h = (v / max) * (H - 20);
        const x = pad + i * bw + bw * 0.15;
        const y = H - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={bw * 0.7}
              height={Math.max(1, h)}
              rx={2}
              className="fill-emerald-500/80"
            >
              <title>{`${labels[i]}: ${v} cliques`}</title>
            </rect>
            {v > 0 && (
              <text
                x={x + (bw * 0.7) / 2}
                y={y - 3}
                textAnchor="middle"
                className="fill-zinc-400"
                fontSize={9}
              >
                {v}
              </text>
            )}
          </g>
        );
      })}
      {/* labels: 1 a cada ~5 dias */}
      {labels.map((l, i) =>
        i % Math.ceil(labels.length / 10) === 0 ? (
          <text
            key={i}
            x={pad + i * bw + bw * 0.35}
            y={H + 14}
            textAnchor="middle"
            className="fill-zinc-400"
            fontSize={9}
          >
            {l}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function HBar({ label, value, max, badge }: { label: string; value: number; max: number; badge?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {badge && (
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${badge}`}>
          {label}
        </span>
      )}
      {!badge && (
        <span className="w-28 truncate text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          {label}
        </span>
      )}
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
        />
      </div>
      <span className="w-14 text-right text-xs font-bold tabular-nums text-zinc-500">
        {value.toLocaleString("pt-BR")}
      </span>
    </div>
  );
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const now = new Date();
  const d1 = new Date(now.getTime() - DAY_MS);
  const d7 = new Date(now.getTime() - 7 * DAY_MS);
  const d30 = new Date(now.getTime() - 30 * DAY_MS);

  const srcCase = sourceSql('p."externalId"');

  const [
    clicksDay,
    clicksTotal,
    clicks24h,
    clicks7d,
    clicksBySrc,
    topProducts,
    topMerchants,
    prodBySrc,
    syncStates,
    totalProducts,
    activeProducts,
  ] = await Promise.all([
    prisma.$queryRawUnsafe<{ day: Date; n: bigint }[]>(
      `SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS n
       FROM "Click" WHERE "createdAt" >= $1
       GROUP BY 1 ORDER BY 1`,
      d30,
    ),
    prisma.click.count(),
    prisma.click.count({ where: { createdAt: { gte: d1 } } }),
    prisma.click.count({ where: { createdAt: { gte: d7 } } }),
    prisma.$queryRawUnsafe<{ src: string; n: bigint }[]>(
      `SELECT ${srcCase} AS src, COUNT(*) AS n
       FROM "Click" c JOIN "Product" p ON p.id = c."productId"
       WHERE c."createdAt" >= $1 GROUP BY 1 ORDER BY 2 DESC`,
      d30,
    ),
    prisma.$queryRawUnsafe<
      { id: number; title: string; merchant: string | null; n: bigint }[]
    >(
      `SELECT p.id, p.title, p.merchant, COUNT(*) AS n
       FROM "Click" c JOIN "Product" p ON p.id = c."productId"
       WHERE c."createdAt" >= $1
       GROUP BY p.id, p.title, p.merchant
       ORDER BY n DESC LIMIT 10`,
      d30,
    ),
    prisma.$queryRawUnsafe<{ merchant: string; n: bigint }[]>(
      `SELECT p.merchant, COUNT(*) AS n
       FROM "Click" c JOIN "Product" p ON p.id = c."productId"
       WHERE c."createdAt" >= $1 AND p.merchant IS NOT NULL
       GROUP BY p.merchant ORDER BY n DESC LIMIT 10`,
      d30,
    ),
    prisma.$queryRawUnsafe<
      { src: string; total: bigint; active: bigint; disc: bigint }[]
    >(
      `SELECT ${sourceSql('"externalId"')} AS src,
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE active) AS active,
              COUNT(*) FILTER (WHERE "discountPct" > 0) AS disc
       FROM "Product" GROUP BY 1`,
    ),
    prisma.syncState.findMany(),
    prisma.product.count(),
    prisma.product.count({ where: { active: true } }),
  ]);

  // Preenche dias faltantes do grafico (30 dias)
  const dayMap = new Map(
    clicksDay.map((r) => [r.day.toISOString().slice(0, 10), Number(r.n)]),
  );
  const chartDays: { label: string; n: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    chartDays.push({
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      n: dayMap.get(key) ?? 0,
    });
  }
  const clicks30d = chartDays.reduce((a, d) => a + d.n, 0);

  const srcLabel = (s: string) =>
    s === "outros" ? "Outros" : SOURCE_LABEL[s as SourceKey] ?? s;
  const srcBadge = (s: string) =>
    s === "lomadee" || s === "ml" || s === "awin"
      ? SOURCE_BADGE[s as SourceKey]
      : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300";

  const maxSrcClick = Math.max(1, ...clicksBySrc.map((r) => Number(r.n)));
  const maxMerchant = Math.max(1, ...topMerchants.map((r) => Number(r.n)));
  // SyncState guarda tambem segredos (ml-token = OAuth ML). So exibe
  // chaves de fonte conhecidas — nunca renderiza tokens.
  const SYNC_LABELS: Record<string, string> = {
    main: "Lomadee",
    ml: "Mercado Livre",
  };
  const syncStatesSafe = syncStates.filter((s) => s.key in SYNC_LABELS);

  const kpis = [
    { label: "Cliques 24h", value: clicks24h },
    { label: "Cliques 7 dias", value: clicks7d },
    { label: "Cliques 30 dias", value: clicks30d },
    { label: "Total de cliques", value: clicksTotal },
    { label: "Produtos ativos", value: activeProducts },
    { label: "Total de produtos", value: totalProducts },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            Painel
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Estatísticas do site
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Logado como {data.user.email}
          </p>
        </div>
        <Link
          href="/ofertas-do-dia"
          className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-sm hover:bg-zinc-100 dark:bg-zinc-900"
        >
          ← Voltar ao site
        </Link>
      </header>

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              {k.label}
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">
              {k.value.toLocaleString("pt-BR")}
            </p>
          </div>
        ))}
      </div>

      {/* Grafico de cliques/dia */}
      <section className="mb-8 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-extrabold uppercase tracking-widest text-zinc-500">
          Cliques por dia — últimos 30 dias
        </h2>
        <BarChart data={chartDays.map((d) => d.n)} labels={chartDays.map((d) => d.label)} />
      </section>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {/* Cliques por fonte */}
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-widest text-zinc-500">
            Cliques por fonte — 30 dias
          </h2>
          <div className="flex flex-col gap-2.5">
            {clicksBySrc.length === 0 && (
              <p className="text-sm text-zinc-400">Sem cliques no período.</p>
            )}
            {clicksBySrc.map((r) => (
              <HBar
                key={r.src}
                label={srcLabel(r.src)}
                badge={srcBadge(r.src)}
                value={Number(r.n)}
                max={maxSrcClick}
              />
            ))}
          </div>
        </section>

        {/* Produtos por fonte */}
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-widest text-zinc-500">
            Produtos por fonte
          </h2>
          <div className="flex flex-col gap-2.5">
            {prodBySrc.map((r) => (
              <div
                key={r.src}
                className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2.5 text-sm dark:border-zinc-800"
              >
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${srcBadge(r.src)}`}
                >
                  {srcLabel(r.src)}
                </span>
                <span className="text-xs text-zinc-500">
                  {Number(r.active).toLocaleString("pt-BR")} ativos ·{" "}
                  {Number(r.disc).toLocaleString("pt-BR")} c/ desconto
                </span>
                <span className="font-extrabold tabular-nums">
                  {Number(r.total).toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {/* Top produtos */}
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-widest text-zinc-500">
            Produtos mais clicados — 30 dias
          </h2>
          <ol className="flex flex-col gap-2">
            {topProducts.map((p, i) => (
              <li key={p.id}>
                <Link
                  href={`/produto/${p.id}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <span className="w-6 text-center text-sm font-extrabold text-zinc-300">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.title}</p>
                    <p className="truncate text-xs text-zinc-400">
                      {p.merchant ?? "—"}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    {Number(p.n)}
                  </span>
                </Link>
              </li>
            ))}
            {topProducts.length === 0 && (
              <p className="text-sm text-zinc-400">Sem cliques no período.</p>
            )}
          </ol>
        </section>

        {/* Top lojas */}
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-widest text-zinc-500">
            Lojas mais clicadas — 30 dias
          </h2>
          <div className="flex flex-col gap-2.5">
            {topMerchants.map((m) => (
              <HBar
                key={m.merchant}
                label={m.merchant}
                value={Number(m.n)}
                max={maxMerchant}
              />
            ))}
            {topMerchants.length === 0 && (
              <p className="text-sm text-zinc-400">Sem cliques no período.</p>
            )}
          </div>
        </section>
      </div>

      {/* Status do sync */}
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-extrabold uppercase tracking-widest text-zinc-500">
          Sincronização das fontes
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {syncStatesSafe.length === 0 && (
            <p className="text-sm text-zinc-400">Nenhum sync registrado.</p>
          )}
          {syncStatesSafe.map((s) => (
            <div
              key={s.key}
              className="rounded-xl border border-zinc-100 p-3 text-sm dark:border-zinc-800"
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold">
                  {SYNC_LABELS[s.key]}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                    s.busyAt
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  }`}
                >
                  {s.busyAt ? "sincronizando" : "ocioso"}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                fase: {s.phase} · página {s.page}
              </p>
              <p className="text-xs text-zinc-500">
                último ciclo:{" "}
                {s.lastCycleAt
                  ? s.lastCycleAt.toLocaleString("pt-BR")
                  : "nunca"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
