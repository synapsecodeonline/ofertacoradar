import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { PV_EXTERNAL_ID } from "@/app/api/pv/route";
import { SOURCE_LABEL, SOURCE_BADGE, type SourceKey } from "@/lib/sources";
import { getRevenueReport, type SourceRevenue } from "@/lib/reports";
import AdminSyncButton from "@/components/AdminSyncButton";
import AdminAutoRefresh from "@/components/AdminAutoRefresh";
import AdminAmzForm from "@/components/AdminAmzForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

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

function sourceSql(col: string) {
  return `CASE
    WHEN ${col} LIKE 'camp-lomadee:%' OR ${col} LIKE 'prod-lomadee:%' THEN 'lomadee'
    WHEN ${col} LIKE 'ml:%' THEN 'ml'
    WHEN ${col} LIKE 'aw:%' THEN 'awin'
    WHEN ${col} LIKE 'amz:%' THEN 'amazon'
    ELSE 'outros' END`;
}

const SRC_CASE = sourceSql('p."externalId"');
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
  badge,
  sub,
}: {
  label: string;
  value: number;
  max: number;
  badge?: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {badge ? (
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${badge}`}>
          {label}
        </span>
      ) : (
        <span className="w-32 shrink-0 truncate text-xs font-semibold text-zinc-600 dark:text-zinc-300" title={label}>
          {label}
        </span>
      )}
      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
      </div>
      <span className="shrink-0 text-right text-xs font-bold tabular-nums text-zinc-500">
        {value.toLocaleString("pt-BR")}
        {sub && <span className="ml-1 font-medium text-zinc-400">{sub}</span>}
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
  const in72h = new Date(now.getTime() + 72 * HOUR_MS);

  const pv = await prisma.product.findUnique({
    where: { externalId: PV_EXTERNAL_ID },
    select: { id: true },
  });
  const pvId = pv?.id ?? -1;

  const [
    pvDay,
    clicksDay,
    clicksTotal,
    clicks24h,
    clicks7d,
    pvTotal,
    pv24h,
    pv7d,
    clicksBySrc,
    clicksByDow,
    clicksByHour,
    topReferers,
    devices,
    clicksByCategory,
    topProducts,
    topMerchants,
    endingCount,
    endingTop,
    noImage,
    lastUpdate,
    syncStates,
  ] = await Promise.all([
    // pageviews por dia (30d)
    prisma.$queryRawUnsafe<{ day: Date; n: bigint }[]>(
      `SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS n
       FROM "Click" WHERE "productId" = ${pvId} AND "createdAt" >= $1
       GROUP BY 1 ORDER BY 1`,
      d30,
    ),
    // cliques afiliado por dia (30d)
    prisma.$queryRawUnsafe<{ day: Date; n: bigint }[]>(
      `SELECT date_trunc('day', c."createdAt") AS day, COUNT(*) AS n
       FROM "Click" c WHERE ${NOT_PV(pvId)} AND c."createdAt" >= $1
       GROUP BY 1 ORDER BY 1`,
      d30,
    ),
    prisma.click.count({ where: { NOT: { productId: pvId } } }),
    prisma.click.count({ where: { createdAt: { gte: d1 }, NOT: { productId: pvId } } }),
    prisma.click.count({ where: { createdAt: { gte: d7 }, NOT: { productId: pvId } } }),
    prisma.click.count({ where: { productId: pvId } }),
    prisma.click.count({ where: { productId: pvId, createdAt: { gte: d1 } } }),
    prisma.click.count({ where: { productId: pvId, createdAt: { gte: d7 } } }),
    // cliques por fonte (30d)
    prisma.$queryRawUnsafe<{ src: string; n: bigint }[]>(
      `SELECT ${SRC_CASE} AS src, COUNT(*) AS n
       FROM "Click" c JOIN "Product" p ON p.id = c."productId"
       WHERE ${NOT_PV(pvId)} AND c."createdAt" >= $1 GROUP BY 1 ORDER BY 2 DESC`,
      d30,
    ),
    // cliques por dia da semana (30d)
    prisma.$queryRawUnsafe<{ dow: number; n: bigint }[]>(
      `SELECT EXTRACT(ISODOW FROM c."createdAt")::int AS dow, COUNT(*) AS n
       FROM "Click" c WHERE ${NOT_PV(pvId)} AND c."createdAt" >= $1
       GROUP BY 1 ORDER BY 1`,
      d30,
    ),
    // cliques por hora do dia (30d)
    prisma.$queryRawUnsafe<{ hr: number; n: bigint }[]>(
      `SELECT EXTRACT(HOUR FROM c."createdAt")::int AS hr, COUNT(*) AS n
       FROM "Click" c WHERE ${NOT_PV(pvId)} AND c."createdAt" >= $1
       GROUP BY 1 ORDER BY 1`,
      d30,
    ),
    // paginas que mais geram clique (referer do /ir)
    prisma.$queryRawUnsafe<{ referer: string; n: bigint }[]>(
      `SELECT c.referer, COUNT(*) AS n
       FROM "Click" c WHERE ${NOT_PV(pvId)} AND c."createdAt" >= $1
         AND c.referer IS NOT NULL AND c.referer <> ''
       GROUP BY c.referer ORDER BY n DESC LIMIT 10`,
      d30,
    ),
    // dispositivo estimado pelo user-agent
    prisma.$queryRawUnsafe<{ dev: string; n: bigint }[]>(
      `SELECT CASE
         WHEN c."userAgent" ~* 'bot|crawl|spider|slurp|facebookexternal' THEN 'bot'
         WHEN c."userAgent" ~* 'mobile|android|iphone' THEN 'mobile'
         ELSE 'desktop' END AS dev,
         COUNT(*) AS n
       FROM "Click" c WHERE ${NOT_PV(pvId)} AND c."createdAt" >= $1
       GROUP BY 1 ORDER BY 2 DESC`,
      d30,
    ),
    // cliques por categoria (30d)
    prisma.$queryRawUnsafe<{ cat: string | null; n: bigint }[]>(
      `SELECT p.category AS cat, COUNT(*) AS n
       FROM "Click" c JOIN "Product" p ON p.id = c."productId"
       WHERE ${NOT_PV(pvId)} AND c."createdAt" >= $1
       GROUP BY p.category ORDER BY n DESC LIMIT 10`,
      d30,
    ),
    // top produtos / lojas (30d)
    prisma.$queryRawUnsafe<{ id: number; title: string; merchant: string | null; n: bigint }[]>(
      `SELECT p.id, p.title, p.merchant, COUNT(*) AS n
       FROM "Click" c JOIN "Product" p ON p.id = c."productId"
       WHERE ${NOT_PV(pvId)} AND c."createdAt" >= $1
       GROUP BY p.id, p.title, p.merchant ORDER BY n DESC LIMIT 10`,
      d30,
    ),
    prisma.$queryRawUnsafe<{ merchant: string; n: bigint }[]>(
      `SELECT p.merchant, COUNT(*) AS n
       FROM "Click" c JOIN "Product" p ON p.id = c."productId"
       WHERE ${NOT_PV(pvId)} AND c."createdAt" >= $1 AND p.merchant IS NOT NULL
       GROUP BY p.merchant ORDER BY n DESC LIMIT 10`,
      d30,
    ),
    // ofertas terminando em <72h
    prisma.product.count({
      where: {
        active: true,
        imageUrl: { not: null },
        endsAt: { gte: now, lte: in72h },
      },
    }),
    prisma.$queryRawUnsafe<{ id: number; title: string; n: bigint }[]>(
      `SELECT p.id, p.title, COUNT(c.id) AS n
       FROM "Product" p LEFT JOIN "Click" c ON c."productId" = p.id
         AND c."createdAt" >= $2
       WHERE p.active AND p."imageUrl" IS NOT NULL
         AND p."endsAt" >= $1 AND p."endsAt" <= $3
       GROUP BY p.id, p.title ORDER BY n DESC LIMIT 5`,
      now,
      d30,
      in72h,
    ),
    // produtos ativos sem imagem, por fonte
    prisma.$queryRawUnsafe<{ src: string; n: bigint }[]>(
      `SELECT ${sourceSql('"externalId"')} AS src, COUNT(*) AS n
       FROM "Product" WHERE active AND "imageUrl" IS NULL
         AND "externalId" <> 'internal:pageview'
       GROUP BY 1 ORDER BY 2 DESC`,
    ),
    // ultima atualizacao por fonte (saude do catalogo)
    prisma.$queryRawUnsafe<{ src: string; last: Date | null }[]>(
      `SELECT ${sourceSql('"externalId"')} AS src, MAX("updatedAt") AS last
       FROM "Product" GROUP BY 1`,
    ),
    prisma.syncState.findMany(),
  ]);

  // Comissao real das fontes (cache de 1h dentro de reports.ts)
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

  // ---- dia da semana / hora ----
  const DOW = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const dowMap = new Map(clicksByDow.map((r) => [r.dow, Number(r.n)]));
  const dowData = [1, 2, 3, 4, 5, 6, 7].map((d) => dowMap.get(d) ?? 0);
  const hrMap = new Map(clicksByHour.map((r) => [r.hr, Number(r.n)]));
  const hrData = Array.from({ length: 24 }, (_, h) => hrMap.get(h) ?? 0);
  const hrLabels = Array.from({ length: 24 }, (_, h) => `${h}h`);

  const srcLabel = (s: string) =>
    s === "outros" ? "Outros" : SOURCE_LABEL[s as SourceKey] ?? s;
  const srcBadge = (s: string) =>
    SOURCE_BADGE[s as SourceKey] ??
    "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300";

  // sync ativo agora? -> auto-refresh mais rapido + badge pulsante
  const syncBusy = syncStates.some(
    (s) => s.busyAt && now.getTime() - s.busyAt.getTime() < 3 * 60_000,
  );

  // ---- alertas ----
  const alerts: { tone: "red" | "amber"; text: string }[] = [];
  const SYNC_SOURCES: Record<string, { name: string }> = {
    main: { name: "Lomadee" },
    ml: { name: "Mercado Livre" },
    awin: { name: "Awin" },
    amazon: { name: "Amazon" },
  };
  // Linhas auxiliares do sync: `${key}:beat` = ultimo sinal de vida,
  // `${key}:err` = ultimo erro registrado pela fonte.
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
    // Ciclo completo demorado NAO e alerta: o badge "desatualizado" ja
    // reflete a saude real do catalogo (freshness dos produtos).
  }
  const lastUpdMap = new Map(lastUpdate.map((r) => [r.src, r.last]));
  for (const [src, last] of lastUpdMap) {
    if (src === "outros" || !last) continue;
    if (now.getTime() - last.getTime() > 7 * DAY_MS) {
      alerts.push({ tone: "amber", text: `Fonte ${srcLabel(src)} sem produtos atualizados há mais de 7 dias.` });
    }
  }
  // "Sem cliques 24h" nao e alerta: catalogo novo / pouco trafego e normal.

  // ---- helpers de exibicao ----
  const maxNum = (...arrs: { n: bigint | number }[][]) =>
    Math.max(1, ...arrs.flat().map((r) => Number(r.n)));

  const maxSrc = maxNum(clicksBySrc);
  const maxDow = maxNum(clicksByDow.map((r) => ({ n: r.n })));
  const maxHr = maxNum(clicksByHour);
  const maxRef = maxNum(topReferers);
  const maxCat = maxNum(clicksByCategory);
  const maxDev = maxNum(devices);
  const maxMerchant = maxNum(topMerchants);

  const kpis = [
    { label: "Cliques 24h", value: clicks24h },
    { label: "Cliques 7d", value: clicks7d },
    { label: "Cliques 30d", value: clicks30d },
    { label: "Total cliques", value: clicksTotal },
    { label: "Visitas 24h", value: pv24h },
    { label: "Visitas 7d", value: pv7d },
    { label: "Visitas 30d", value: pv30d },
    { label: "Total visitas", value: pvTotal },
  ];

  const catLabel = (c: string | null) =>
    c ? c.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "Sem categoria";
  const devLabel: Record<string, string> = { mobile: "Mobile", desktop: "Desktop", bot: "Bots" };

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Painel</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Estatísticas do site</h1>
          <p className="mt-1 text-sm text-zinc-500">Logado como {data.user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/admin/export"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-bold shadow-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
          >
            Exportar CSV
          </a>
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

      {/* Sync das fontes — sempre visivel no topo */}
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
          <div className="flex flex-col gap-2.5">
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
              // saude real do catalogo = quando os PRODUTOS da fonte
              // foram atualizados pela ultima vez (nao o ciclo interno)
              const prodSrc = s.key === "main" ? "lomadee" : s.key;
              const prodLast = lastUpdMap.get(prodSrc) ?? null;
              const prodAge = prodLast ? now.getTime() - prodLast.getTime() : null;
              const catalogFresh = prodAge !== null && prodAge < 24 * 3_600_000;
              // status agregado: o que importa e o catalogo estar em dia
              // e a fonte estar respondendo — nao o estado interno do ciclo
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
                    fase: {s.phase} · página {s.page}
                  </p>
                  <p className="text-xs text-zinc-500">
                    produtos atualizados: {timeAgo(prodLast, now)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    última atividade do sync: {timeAgo(beatAt ?? s.busyAt, now)}
                  </p>
                  {busyFresh && (
                    <p className="text-xs text-zinc-500">
                      trabalhando desde {timeAgo(s.busyAt, now)}
                    </p>
                  )}
                  {errRecent && (
                    <p className="mt-1 text-xs font-semibold text-orange-600 dark:text-orange-400">
                      erro: {err!.phase}
                      {err!.busyAt && ` (${timeAgo(err!.busyAt, now)})`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Cadastro manual de produtos Amazon (API ainda nao liberada) */}
      <div className="mb-8">
        <Card title="Adicionar produto Amazon">
          <AdminAmzForm />
        </Card>
      </div>

      {/* Receita / comissao estimada */}
      <div className="mb-8">
        <Card title="Receita / comissão estimada — 30 dias">
          <div className="flex flex-col gap-3">
            {revenue.map((r) => (
              <RevenueRow key={r.source} r={r} />
            ))}
          </div>
          <p className="mt-4 text-[11px] text-zinc-400">
            Comissão Lomadee vem da API de pedidos (dados reais, podem incluir
            pedidos ainda pendentes de aprovação). ML e Awin não expõem API
            pública de ganhos.
          </p>
        </Card>
      </div>

      {/* Graficos diarios */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card title="Cliques por dia — 30 dias">
          <BarChart data={clicksSeries.map((d) => d.n)} labels={clicksSeries.map((d) => d.label)} />
        </Card>
        <Card title="Visitas por dia — 30 dias">
          <BarChart
            data={pvSeries.map((d) => d.n)}
            labels={pvSeries.map((d) => d.label)}
            color="fill-sky-500/80"
          />
        </Card>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {/* Dia da semana */}
        <Card title="Cliques por dia da semana — 30 dias">
          <div className="flex flex-col gap-2">
            {DOW.slice(1).map((d, i) => (
              <HBar key={d} label={d} value={dowData[i]} max={maxDow} />
            ))}
          </div>
        </Card>
        {/* Horario */}
        <Card title="Cliques por horário — 30 dias">
          <BarChart data={hrData} labels={hrLabels} color="fill-violet-500/80" />
        </Card>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {/* Origem */}
        <Card title="Páginas que mais geram clique — 30 dias">
          <div className="flex flex-col gap-2">
            {topReferers.length === 0 && <p className="text-sm text-zinc-400">Sem dados.</p>}
            {topReferers.map((r) => (
              <HBar key={r.referer} label={r.referer} value={Number(r.n)} max={maxRef} />
            ))}
          </div>
        </Card>
        {/* Dispositivo */}
        <Card title="Dispositivo — 30 dias">
          <div className="flex flex-col gap-2">
            {devices.map((d) => (
              <HBar key={d.dev} label={devLabel[d.dev] ?? d.dev} value={Number(d.n)} max={maxDev} />
            ))}
          </div>
        </Card>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        {/* Categoria */}
        <Card title="Cliques por categoria — 30 dias">
          <div className="flex flex-col gap-2">
            {clicksByCategory.map((c) => (
              <HBar key={c.cat ?? "null"} label={catLabel(c.cat)} value={Number(c.n)} max={maxCat} />
            ))}
          </div>
        </Card>
        {/* Fonte */}
        <Card title="Cliques por fonte — 30 dias">
          <div className="flex flex-col gap-2">
            {clicksBySrc.length === 0 && <p className="text-sm text-zinc-400">Sem cliques.</p>}
            {clicksBySrc.map((r) => (
              <HBar key={r.src} label={srcLabel(r.src)} badge={srcBadge(r.src)} value={Number(r.n)} max={maxSrc} />
            ))}
          </div>
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

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        {/* Terminando em breve */}
        <Card title="Terminando em breve">
          <p className="mb-3 text-3xl font-extrabold tabular-nums">{endingCount}</p>
          <p className="mb-3 text-xs text-zinc-500">ofertas ativas com fim em menos de 72h</p>
          <ol className="flex flex-col gap-1">
            {endingTop.map((p, i) => (
              <li key={p.id}>
                <Link
                  href={`/produto/${p.id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <span className="text-xs font-extrabold text-zinc-300">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                  <span className="text-xs font-bold text-zinc-400">{Number(p.n)} cliques</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
        {/* Sem imagem */}
        <Card title="Produtos sem imagem">
          <div className="flex flex-col gap-2">
            {noImage.length === 0 && <p className="text-sm text-zinc-400">Nenhum. Catálogo limpo.</p>}
            {noImage.map((r) => (
              <HBar key={r.src} label={srcLabel(r.src)} badge={srcBadge(r.src)} value={Number(r.n)} max={Math.max(1, ...noImage.map((x) => Number(x.n)))} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
