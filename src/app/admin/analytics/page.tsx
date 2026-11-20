import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false },
};

// Analytics real: tabela Event (pageview|click) com sessao, UTM e
// produto. Antes do migration rodar, mostra estado vazio graceful.
export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const now = new Date();
  const d1 = new Date(now.getTime() - 86_400_000);
  const d7 = new Date(now.getTime() - 7 * 86_400_000);
  const d14 = new Date(now.getTime() - 14 * 86_400_000);

  const [
    pvTotal,
    clickTotal,
    pv24h,
    click24h,
    pv7d,
    click7d,
    subs,
    recentSubs,
    events14d,
  ] = await Promise.all([
      prisma.event.count({ where: { type: "pageview" } }).catch(() => 0),
      prisma.event.count({ where: { type: "click" } }).catch(() => 0),
      prisma.event.count({
        where: { type: "pageview", createdAt: { gte: d1 } },
      }).catch(() => 0),
      prisma.event.count({
        where: { type: "click", createdAt: { gte: d1 } },
      }).catch(() => 0),
      prisma.event.count({
        where: { type: "pageview", createdAt: { gte: d7 } },
      }).catch(() => 0),
      prisma.event.count({
        where: { type: "click", createdAt: { gte: d7 } },
      }).catch(() => 0),
      prisma.subscriber.count().catch(() => 0),
      prisma.subscriber
        .findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { email: true, createdAt: true, productId: true },
        })
        .catch(() => [] as { email: string; createdAt: Date; productId: number | null }[]),
      prisma.event
        .findMany({
          where: { createdAt: { gte: d14 } },
          select: {
            type: true,
            createdAt: true,
            productId: true,
            utmSource: true,
            sessionId: true,
          },
          orderBy: { createdAt: "asc" },
          take: 20000,
        })
        .catch(() => [] as {
          type: string;
          createdAt: Date;
          productId: number | null;
          utmSource: string | null;
          sessionId: string | null;
        }[]),
    ]);

  // Buckets por dia (ultimos 14 dias)
  const days: { pv: number; clk: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    days.push({ pv: 0, clk: 0 });
  }
  const dayIndex = (d: Date) => {
    const diff = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
    return 13 - diff;
  };
  const utmCount = new Map<string, number>();
  const clickProducts = new Map<number, number>();
  const sessions = new Set<string>();
  for (const e of events14d) {
    const idx = dayIndex(e.createdAt);
    if (idx >= 0 && idx < 14) {
      if (e.type === "pageview") days[idx].pv++;
      else if (e.type === "click") days[idx].clk++;
    }
    if (e.type === "pageview") {
      if (e.sessionId) sessions.add(e.sessionId);
      const u = e.utmSource ?? "(direto)";
      utmCount.set(u, (utmCount.get(u) ?? 0) + 1);
    }
    if (e.type === "click" && e.productId) {
      clickProducts.set(
        e.productId,
        (clickProducts.get(e.productId) ?? 0) + 1,
      );
    }
  }

  // Top produtos clicados -> resolve titulos
  const topIds = [...clickProducts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);
  const topProducts = topIds.length
    ? await prisma.product.findMany({
        where: { id: { in: topIds } },
        select: { id: true, title: true, merchant: true },
      })
    : [];
  const titleOf = new Map(topProducts.map((p) => [p.id, p]));

  const topUtm = [...utmCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const maxDay = Math.max(1, ...days.map((d) => Math.max(d.pv, d.clk)));

  const conversion =
    pv7d > 0 ? ((click7d / pv7d) * 100).toFixed(2) : "0.00";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">
      <header className="mb-6">
        <Link
          href="/admin"
          className="text-xs font-semibold text-zinc-500 hover:text-emerald-600"
        >
          ← Admin
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Dados reais da tabela Event — visitas, cliques, canais e produtos.
        </p>
      </header>

      {pvTotal === 0 && clickTotal === 0 ? (
        <p className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          Nenhum evento ainda — os dados começam a aparecer conforme os
          visitantes usam o site.
        </p>
      ) : (
        <>
          {/* KPIs */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Visitas 24h", pv24h],
              ["Cliques 24h", click24h],
              ["Conversão 7d", `${conversion}%`],
              ["Subscribers", subs],
            ].map(([label, v]) => (
              <div
                key={label as string}
                className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-extrabold">{v}</p>
              </div>
            ))}
          </div>

          {/* Grafico 14 dias */}
          <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-zinc-500">
              Últimos 14 dias
            </h2>
            <div className="flex h-40 items-end gap-1.5">
              {days.map((d, i) => (
                <div
                  key={i}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${d.pv} visitas · ${d.clk} cliques`}
                >
                  <div className="flex w-full flex-col-reverse gap-px">
                    <div
                      className="w-full rounded-t bg-emerald-500/80"
                      style={{ height: `${(d.pv / maxDay) * 100}%`, minHeight: d.pv ? 2 : 0 }}
                    />
                    <div
                      className="w-full rounded-t bg-orange-500/80"
                      style={{ height: `${(d.clk / maxDay) * 100}%`, minHeight: d.clk ? 2 : 0 }}
                    />
                  </div>
                  <span className="text-[9px] text-zinc-400">
                    {new Date(now.getTime() - (13 - i) * 86_400_000)
                      .toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-zinc-400">
              Verde = visitas · Laranja = cliques de afiliado
            </p>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Fontes de trafego */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-zinc-500">
                Canais de tráfego (14d)
              </h2>
              {topUtm.length === 0 ? (
                <p className="text-sm text-zinc-400">Sem dados de UTM ainda.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {topUtm.map(([src, n]) => (
                    <li key={src} className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{src}</span>
                      <span className="text-zinc-500">{n} visitas</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Produtos mais clicados */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-zinc-500">
                Produtos mais clicados (14d)
              </h2>
              {topIds.length === 0 ? (
                <p className="text-sm text-zinc-400">Nenhum clique registrado ainda.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {topIds.map((id) => {
                    const p = titleOf.get(id);
                    const n = clickProducts.get(id) ?? 0;
                    return (
                      <li key={id} className="flex items-start justify-between gap-2 text-sm">
                        <Link
                          href={`/produto/${id}`}
                          className="line-clamp-1 font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          {p?.title ?? `#${id}`}
                        </Link>
                        <span className="shrink-0 font-bold text-zinc-500">{n}×</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Subscribers recentes */}
          {recentSubs.length > 0 && (
            <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-zinc-500">
                Últimos subscribers ({subs})
              </h2>
              <ul className="flex flex-col gap-1.5 text-sm">
                {recentSubs.map((s) => (
                  <li key={s.email} className="flex items-center justify-between">
                    <span className="font-mono text-xs">{s.email}</span>
                    <span className="text-xs text-zinc-400">
                      {s.createdAt.toLocaleDateString("pt-BR")}
                      {s.productId ? ` · produto #${s.productId}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-6 text-center text-xs text-zinc-400">
            {pv7d.toLocaleString("pt-BR")} visitas e {click7d.toLocaleString("pt-BR")}{" "}
            cliques nos últimos 7 dias · {sessions.size} sessões identificadas
          </p>
        </>
      )}
    </div>
  );
}
