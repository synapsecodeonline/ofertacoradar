import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { PV_EXTERNAL_ID } from "@/app/api/pv/route";
import { getRevenueReport, type SourceRevenue } from "@/lib/reports";
import AdminSyncButton from "@/components/AdminSyncButton";
import AdminAutoRefresh from "@/components/AdminAutoRefresh";
import AdminAmzForm from "@/components/AdminAmzForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const DAY_MS = 86_400_000;

function timeAgo(d: Date | null | undefined, now: Date): string {
  if (!d) return "nunca";
  const s = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

// Cliques de afiliado = todos menos os pageviews (produto sentinela)
const NOT_PV = (pvId: number) => `c."productId" <> ${pvId}`;

function BarChart({
  data,
  labels,
  color = "fill-emerald-500/80",
}: {
  data: number[];
  labels: string[];
  color?: string;
}) {
  const max = Math.max(1, ...data);
  const W = 720;
  const H = 160;
  const pad = 8;
  const bw = (W - pad * 2) / Math.max(1, data.length);
  const step = Math.max(1, Math.ceil(labels.length / 12));
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full">
      {data.map((v, i) => {
        const h = (v / max) * (H - 20);
        const x = pad + i * bw + bw * 0.15;
        const y = H - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw * 0.7} height={Math.max(1, h)} rx={2} className={color}>
              <title>{`${labels[i]}: ${v}`}</title>
            </rect>
            {v > 0 && (
              <text x={x + (bw * 0.7) / 2} y={y - 3} textAnchor="middle" className="fill-zinc-400" fontSize={9}>
                {v}
              </text>
            )}
          </g>
        );
      })}
      {labels.map((l, i) =>
        i % step === 0 ? (
          <text key={i} x={pad + i * bw + bw * 0.35} y={H + 14} textAnchor="middle" className="fill-zinc-400" fontSize={9}>
            {l}
          </text>
        ) : null,
      )}
    </svg>
  );
}

function HBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0 truncate text-xs font-semibold text-zinc-600 dark:text-zinc-300" title={label}>
        {label}
      </span>
      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
      </div>
      <span className="shrink-0 text-right text-xs font-bold tabular-nums text-zinc-500">
        {value.toLocaleString("pt-BR")}
      </span>
    </div>
  );
}

function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-extrabold uppercase tracking-widest text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

const REVENUE_LABEL: Record<string, string> = {
  lomadee: "Lomadee",
  mercadolivre: "Mercado Livre",
  awin: "Awin",
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function RevenueRow({ r }: { r: SourceRevenue }) {
  const label = REVENUE_LABEL[r.source] ?? r.source;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-100 px-4 py-3 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <span className="text-sm font-extrabold">{label}</span>
        {r.available ? (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            API conectada
          </span>
        ) : (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-zinc-500 dark:bg-zinc-800">
            sem API pública
          </span>
        )}
      </div>
      {r.available ? (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className="text-zinc-500">
            Pedidos: <b className="tabular-nums text-zinc-800 dark:text-zinc-200">{r.orders}</b>
          </span>
          <span className="text-zinc-500">
            Vendas: <b className="tabular-nums text-zinc-800 dark:text-zinc-200">{brl(r.sales ?? 0)}</b>
          </span>
          <span className="text-zinc-500">
            Comissão:{" "}
            <b className="tabular-nums text-emerald-600 dark:text-emerald-400">
              {brl(r.commission ?? 0)}
            </b>
          </span>
          <span className="text-xs text-zinc-400">
            aprov. {brl(r.commissionApproved ?? 0)} · pend. {brl(r.commissionPending ?? 0)}
          </span>
        </div>
      ) : (
        <span className="text-xs text-zinc-400">{r.reason}</span>
      )}
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

  const pv = await prisma.product.findUnique({
    where: { externalId: PV_EXTERNAL_ID },
    select: { id: true },
  });
  const pvId = pv?.id ?? -1;

  const [
    pvDay,
    clicksDay,
    clicks24h,
    clicks7d,
    // Analytics real (tabela Event)
    evPv24h,
    evClk24h,
    evPv7d,
    evClk7d,
    subsTotal,
    recentSubs,
    utmRows,
    topProducts,
    topMerchants,
    lastUpdate,
    syncStates,
  ] = await Promise.all([
    // series diarias 30d (tabela Click — historico completo)
    prisma.$queryRawUnsafe<{ day: Date; n: bigint }[]>(
      `SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS n
       FROM "ofertacoradar"."Click" WHERE "productId" = ${pvId} AND "createdAt" >= $1
       GROUP BY 1 ORDER BY 1`,
      d30,
    ),
    prisma.$queryRawUnsafe<{ day: Date; n: bigint }[]>(
      `SELECT date_trunc('day', c."createdAt") AS day, COUNT(*) AS n
       FROM "ofertacoradar"."Click" c WHERE ${NOT_PV(pvId)} AND c."createdAt" >= $1
       GROUP BY 1 ORDER BY 1`,
      d30,
    ),
    prisma.click.count({ where: { createdAt: { gte: d1 }, NOT: { productId: pvId } } }),
    prisma.click.count({ where: { createdAt: { gte: d7 }, NOT: { productId: pvId } } }),
    // KPIs reais da tabela Event (fallback zero pre-migracao)
    prisma.event.count({ where: { type: "pageview", createdAt: { gte: d1 } } }).catch(() => 0),
    prisma.event.count({ where: { type: "click", createdAt: { gte: d1 } } }).catch(() => 0),
    prisma.event.count({ where: { type: "pageview", createdAt: { gte: d7 } } }).catch(() => 0),
    prisma.event.count({ where: { type: "click", createdAt: { gte: d7 } } }).catch(() => 0),
    prisma.subscriber.count().catch(() => 0),
    prisma.subscriber
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { email: true, createdAt: true },
      })
      .catch(() => [] as { email: string; createdAt: Date }[]),
    // canais de trafego (UTM) — ultimos eventos de pageview
    prisma.event
      .findMany({
        where: { type: "pageview", createdAt: { gte: d7 } },
        select: { utmSource: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      })
      .catch(() => [] as { utmSource: string | null }[]),
    // top produtos / lojas (30d, tabela Click)
    prisma.$queryRawUnsafe<{ id: number; title: string; merchant: string | null; n: bigint }[]>(
      `SELECT p.id, p.title, p.merchant, COUNT(*) AS n
       FROM "ofertacoradar"."Click" c JOIN "ofertacoradar"."Product" p ON p.id = c."productId"
       WHERE ${NOT_PV(pvId)} AND c."createdAt" >= $1
       GROUP BY p.id, p.title, p.merchant ORDER BY n DESC LIMIT 10`,
      d30,
    ),
    prisma.$queryRawUnsafe<{ merchant: string; n: bigint }[]>(
      `SELECT p.merchant, COUNT(*) AS n
       FROM "ofertacoradar"."Click" c JOIN "ofertacoradar"."Product" p ON p.id = c."productId"
       WHERE ${NOT_PV(pvId)} AND c."createdAt" >= $1 AND p.merchant IS NOT NULL
       GROUP BY p.merchant ORDER BY n DESC LIMIT 10`,
      d30,
    ),
    // ultima atualizacao por fonte (saude do catalogo)
    prisma.$queryRawUnsafe<{ src: string; last: Date | null }[]>(
      `SELECT CASE
         WHEN "externalId" LIKE 'camp-lomadee:%' OR "externalId" LIKE 'prod-lomadee:%' THEN 'lomadee'
         WHEN "externalId" LIKE 'ml:%' THEN 'ml'
         WHEN "externalId" LIKE 'aw:%' THEN 'awin'
         WHEN "externalId" LIKE 'amz:%' THEN 'amazon'
         ELSE 'outros' END AS src, MAX("updatedAt") AS last
       FROM "ofertacoradar"."Product" GROUP BY 1`,
    ),
    prisma.syncState.findMany(),
  ]);

  const revenue = await getRevenueReport(30);

  // ---- series diarias ----
  const fillDays = (rows: { day: Date; n: bigint }[]) => {
    const m = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.n)]));
    const out: { label: string; n: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY_MS);
      out.push({
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        n: m.get(d.toISOString().slice(0, 10)) ?? 0,
      });
    }
    return out;
  };
  const clicksSeries = fillDays(clicksDay);
  const pvSeries = fillDays(pvDay);
  const clicks30d = clicksSeries.reduce((a, d) => a + d.n, 0);
  const pv30d = pvSeries.reduce((a, d) => a + d.n, 0);

  // ---- canais UTM (Event) ----
  const utmCount = new Map<string, number>();
  for (const r of utmRows) {
    const k = r.utmSource ?? "(direto)";
    utmCount.set(k, (utmCount.get(k) ?? 0) + 1);
  }
  const topUtm = [...utmCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxUtm = Math.max(1, ...topUtm.map(([, n]) => n));

  // ---- sync / alertas ----
  const syncBusy = syncStates.some(
    (s) => s.busyAt && now.getTime() - s.busyAt.getTime() < 3 * 60_000,
  );

  const alerts: { tone: "red" | "amber"; text: string }[] = [];
  const SYNC_SOURCES: Record<string, { name: string }> = {
    main: { name: "Lomadee" },
    ml: { name: "Mercado Livre" },
    awin: { name: "Awin" },
    amazon: { name: "Amazon" },
  };
  const beatMap = new Map(
    syncStates.filter((s) => s.key.endsWith(":beat")).map((s) => [s.key.slice(0, -5), s]),
  );
  const errMap = new Map(
    syncStates.filter((s) => s.key.endsWith(":err")).map((s) => [s.key.slice(0, -4), s]),
  );

  for (const s of syncStates) {
    const cfg = SYNC_SOURCES[s.key];
    if (!cfg) continue;
    const busyAge = s.busyAt ? now.getTime() - s.busyAt.getTime() : null;
    const busyFresh = busyAge !== null && busyAge < 3 * 60_000;
    const beatAt = beatMap.get(s.key)?.busyAt ?? null;
    const beatAge = beatAt ? now.getTime() - beatAt.getTime() : null;
    const active = busyFresh || (beatAge !== null && beatAge < 5 * 60_000);
    const err = errMap.get(s.key);
    if (busyAge !== null && busyAge > 3 * 60_000) {
      alerts.push({ tone: "red", text: `Sync de ${cfg.name} travado (trava com mais de 3min).` });
    } else if (!active) {
      alerts.push({
        tone: "red",
        text: `Sync de ${cfg.name} parado — sem atividade há ${beatAge !== null ? timeAgo(beatAt, now) : "muito tempo"}. Verifique o agendador (cron) e a conexão.`,
      });
    } else if (err?.busyAt && now.getTime() - err.busyAt.getTime() < 60 * 60_000) {
      alerts.push({ tone: "amber", text: `Sync de ${cfg.name} com erro recente: ${err.phase}` });
    }
  }
  const lastUpdMap = new Map(lastUpdate.map((r) => [r.src, r.last]));
  const srcName: Record<string, string> = {
    lomadee: "Lomadee",
    ml: "Mercado Livre",
    awin: "Awin",
    amazon: "Amazon",
  };
  for (const [src, last] of lastUpdMap) {
    if (src === "outros" || !last) continue;
    if (now.getTime() - last.getTime() > 7 * DAY_MS) {
      alerts.push({ tone: "amber", text: `Fonte ${srcName[src] ?? src} sem produtos atualizados há mais de 7 dias.` });
    }
  }

  // ---- KPIs: so o que importa ----
  const conversion7d = evPv7d > 0 ? ((evClk7d / evPv7d) * 100).toFixed(2) : "0.00";
  const kpis = [
    { label: "Visitas 24h", value: evPv24h },
    { label: "Cliques 24h", value: evClk24h || clicks24h },
    { label: "Conversão 7d", value: `${conversion7d}%` },
    { label: "Subscribers", value: subsTotal },
  ];

  const maxMerchant = Math.max(1, ...topMerchants.map((m) => Number(m.n)));

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Painel</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-zinc-500">Logado como {data.user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/admin/export"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-bold shadow-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
          >
            Exportar CSV
          </a>
          <a
            href="/api/admin/subscribers"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-bold shadow-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
          >
            Subscribers
          </a>
          <Link
            href="/admin/kit"
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            Kit Instagram
          </Link>
          <AdminSyncButton />
          <Link
            href="/"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-bold shadow-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
          >
            ← Site
          </Link>
        </div>
      </header>
      <AdminAutoRefresh seconds={syncBusy ? 15 : 60} />

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                a.tone === "red"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
              }`}
            >
              {a.text}
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{k.label}</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">{k.value.toLocaleString("pt-BR")}</p>
          </div>
        ))}
      </div>

      {/* Sync das fontes */}
      <div className="mb-8">
        <Card
          title={
            <span className="flex items-center gap-2">
              Sincronização das fontes
              {syncBusy && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
              )}
            </span>
          }
        >
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {syncStates.filter((s) => s.key in SYNC_SOURCES).length === 0 && (
              <p className="text-sm text-zinc-400">Nenhum sync registrado.</p>
            )}
            {syncStates
              .filter((s) => s.key in SYNC_SOURCES)
              .map((s) => {
              const cfg = SYNC_SOURCES[s.key];
              const busyFresh =
                !!s.busyAt && now.getTime() - s.busyAt.getTime() < 3 * 60_000;
              const beatAt = beatMap.get(s.key)?.busyAt ?? null;
              const beatAge = beatAt ? now.getTime() - beatAt.getTime() : null;
              const active = busyFresh || (beatAge !== null && beatAge < 5 * 60_000);
              const err = errMap.get(s.key);
              const errRecent = !!err?.busyAt && now.getTime() - err.busyAt.getTime() < 24 * 3_600_000;
              const prodSrc = s.key === "main" ? "lomadee" : s.key;
              const prodLast = lastUpdMap.get(prodSrc) ?? null;
              const prodAge = prodLast ? now.getTime() - prodLast.getTime() : null;
              const catalogFresh = prodAge !== null && prodAge < 24 * 3_600_000;
              const status = busyFresh
                ? { label: "sincronizando", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" }
                : !active
                  ? { label: "parado", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" }
                  : errRecent
                    ? { label: "com erro", cls: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" }
                    : catalogFresh
                      ? { label: "atualizado", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" }
                      : { label: "desatualizado", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" };
              return (
                <div key={s.key} className="rounded-xl border border-zinc-100 p-3 text-sm dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold">{cfg.name}</span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${status.cls}`}
                    >
                      {busyFresh && (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                      )}
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    produtos atualizados: {timeAgo(prodLast, now)}
                  </p>
                  {errRecent && (
                    <p className="mt-1 text-xs font-semibold text-orange-600 dark:text-orange-400">
                      erro: {err!.phase}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Cadastro manual Amazon */}
      <div className="mb-8">
        <Card title="Adicionar produto Amazon">
          <AdminAmzForm />
        </Card>
      </div>

      {/* Receita */}
      <div className="mb-8">
        <Card title="Receita / comissão estimada — 30 dias">
          <div className="flex flex-col gap-3">
            {revenue.map((r) => (
              <RevenueRow key={r.source} r={r} />
            ))}
          </div>
        </Card>
      </div>

      {/* Graficos diarios */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card title={`Cliques por dia — 30d (${clicks30d.toLocaleString("pt-BR")})`}>
          <BarChart data={clicksSeries.map((d) => d.n)} labels={clicksSeries.map((d) => d.label)} />
        </Card>
        <Card title={`Visitas por dia — 30d (${pv30d.toLocaleString("pt-BR")})`}>
          <BarChart
            data={pvSeries.map((d) => d.n)}
            labels={pvSeries.map((d) => d.label)}
            color="fill-sky-500/80"
          />
        </Card>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {/* Canais de trafego */}
        <Card title="Canais de tráfego — 7d">
          <div className="flex flex-col gap-2">
            {topUtm.length === 0 && <p className="text-sm text-zinc-400">Sem dados ainda.</p>}
            {topUtm.map(([src, n]) => (
              <HBar key={src} label={src} value={n} max={maxUtm} />
            ))}
          </div>
        </Card>
        {/* Subscribers */}
        <Card title={`Subscribers (${subsTotal})`}>
          {recentSubs.length === 0 ? (
            <p className="text-sm text-zinc-400">Nenhum email capturado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {recentSubs.map((s) => (
                <li key={s.email} className="flex items-center justify-between">
                  <span className="font-mono text-xs">{s.email}</span>
                  <span className="text-xs text-zinc-400">
                    {s.createdAt.toLocaleDateString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {/* Top produtos */}
        <Card title="Produtos mais clicados — 30 dias">
          <ol className="flex flex-col gap-1">
            {topProducts.map((p, i) => (
              <li key={p.id}>
                <Link
                  href={`/produto/${p.id}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <span className="w-6 text-center text-sm font-extrabold text-zinc-300">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.title}</p>
                    <p className="truncate text-xs text-zinc-400">{p.merchant ?? "—"}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    {Number(p.n)}
                  </span>
                </Link>
              </li>
            ))}
            {topProducts.length === 0 && <p className="text-sm text-zinc-400">Sem cliques.</p>}
          </ol>
        </Card>
        {/* Top lojas */}
        <Card title="Lojas mais clicadas — 30 dias">
          <div className="flex flex-col gap-2">
            {topMerchants.map((m) => (
              <HBar key={m.merchant} label={m.merchant} value={Number(m.n)} max={maxMerchant} />
            ))}
            {topMerchants.length === 0 && <p className="text-sm text-zinc-400">Sem cliques.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
