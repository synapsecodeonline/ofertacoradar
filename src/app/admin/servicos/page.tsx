import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Serviços — Admin", robots: { index: false } };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ofertacoradar.com.br";
const CHAT_URL = process.env.NEXT_PUBLIC_CHATWOOT_BASE_URL ?? "https://chat.ofertacoradar.com.br";
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPA_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const GH_REPO = "synapsecodeonline/ofertacoradar";
const DB_LIMIT_MB = Number(process.env.DB_DISK_LIMIT_MB ?? 500);

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

type HttpCheck = { ok: boolean; ms: number; status?: number; error?: string };
const FALLBACK: HttpCheck = { ok: false, ms: 0 };

async function httpCheck(
  url: string,
  init?: RequestInit & { next?: { revalidate?: number } },
): Promise<HttpCheck> {
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    return { ok: r.ok, ms: Date.now() - t0, status: r.status };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
  }
}

function Badge({ ok, label }: { ok: boolean | null; label?: string }) {
  if (ok === null) {
    return <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-zinc-500 dark:bg-zinc-800">{label ?? "—"}</span>;
  }
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${
        ok
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
      }`}
    >
      {ok ? "no ar" : "fora do ar"}
    </span>
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

interface GhRun {
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  event: string;
}

export default async function ServicosPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const now = new Date();

  // ---- checagens externas (paralelas, timeout 8s cada) ----
  const [site, chat, supaAuth, supaRest, ghWorkflows, ghRuns] = await Promise.all([
    httpCheck(`${SITE_URL}/api/health`),
    httpCheck(`${CHAT_URL}/`),
    // /auth/v1/health tambem responde 401 sem apikey valida — <500 = no ar.
    SUPA_URL
      ? httpCheck(`${SUPA_URL}/auth/v1/health`).then((r) => ({
          ...r,
          ok: r.status != null ? r.status < 500 : r.ok,
        }))
      : Promise.resolve(FALLBACK),
    // /rest/v1/ responde 401 sem tabela/apikey granular — para checar
    // "esta no ar" qualquer resposta < 500 serve; so erro de rede/5xx e down.
    SUPA_URL && SUPA_KEY
      ? httpCheck(`${SUPA_URL}/rest/v1/`, {
          headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
        }).then((r) => ({ ...r, ok: r.status != null ? r.status < 500 : r.ok }))
      : Promise.resolve(FALLBACK),
    fetch(`https://api.github.com/repos/${GH_REPO}/actions/workflows`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "ofertacoradar-admin" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    fetch(`https://api.github.com/repos/${GH_REPO}/actions/runs?per_page=6`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "ofertacoradar-admin" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  // ---- banco ----
  const [{ size: dbBytes }] = (await prisma.$queryRawUnsafe(
    `SELECT pg_database_size(current_database()) AS size`,
  )) as { size: bigint }[];
  const dbMB = Number(dbBytes) / 1048576;
  const dbPct = (dbMB / DB_LIMIT_MB) * 100;

  const tables = (await prisma.$queryRawUnsafe(
    `SELECT relname AS tabela, pg_total_relation_size(relid) AS bytes
     FROM pg_catalog.pg_statio_user_tables
     WHERE schemaname = 'ofertacoradar'
     ORDER BY bytes DESC LIMIT 8`,
  )) as { tabela: string; bytes: bigint }[];

  const bySource = (await prisma.$queryRawUnsafe(
    `SELECT CASE
       WHEN "externalId" LIKE 'camp-lomadee:%' OR "externalId" LIKE 'prod-lomadee:%' THEN 'Lomadee'
       WHEN "externalId" LIKE 'ml:%' THEN 'Mercado Livre'
       WHEN "externalId" LIKE 'aw:%' THEN 'Awin'
       WHEN "externalId" LIKE 'amz:%' THEN 'Amazon'
       ELSE 'outros' END AS fonte,
       COUNT(*) AS n, MAX("updatedAt") AS last
     FROM "ofertacoradar"."Product" GROUP BY 1 ORDER BY n DESC`,
  )) as { fonte: string; n: bigint; last: Date | null }[];

  const [syncStates, deadLinksRow, kitRow, subsTotal] = await Promise.all([
    prisma.syncState.findMany(),
    prisma.scriptState.findUnique({ where: { key: "dead-links" } }).catch(() => null),
    prisma.scriptState.findUnique({ where: { key: "kit-sent" } }).catch(() => null),
    prisma.subscriber.count().catch(() => 0),
  ]);
  const deadLinks = Array.isArray(deadLinksRow?.value) ? (deadLinksRow!.value as string[]).length : 0;

  // ---- status dos syncs (mesma lógica do /admin) ----
  const SYNC_SOURCES: Record<string, string> = {
    main: "Lomadee",
    ml: "Mercado Livre",
    awin: "Awin",
    amazon: "Amazon",
  };
  const beatMap = new Map(
    syncStates.filter((s) => s.key.endsWith(":beat")).map((s) => [s.key.slice(0, -5), s]),
  );
  const errMap = new Map(
    syncStates.filter((s) => s.key.endsWith(":err")).map((s) => [s.key.slice(0, -4), s]),
  );
  // Fonte sem credenciais nao esta "parada" — esta desligada. Mostra
  // "nao configurado" em cinza em vez de alarmar como se tivesse quebrado.
  const SOURCE_CONFIGURED: Record<string, boolean> = {
    main: !!(process.env.LOMADEE_API_KEY || process.env.FEED_URL),
    ml: !!(process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET) && process.env.ML_SYNC !== "0",
    awin: !!process.env.AWIN_FEEDS,
    amazon: !!(process.env.AMZ_API_KEY && process.env.AMZ_API_SECRET),
  };
  const syncRows = Object.keys(SYNC_SOURCES).map((key) => {
    const configured = SOURCE_CONFIGURED[key] ?? true;
    const s = syncStates.find((x) => x.key === key);
    const busyFresh = !!s?.busyAt && now.getTime() - s.busyAt.getTime() < 3 * 60_000;
    const beatAt = beatMap.get(key)?.busyAt ?? null;
    const beatAge = beatAt ? now.getTime() - beatAt.getTime() : null;
    const active = busyFresh || (beatAge !== null && beatAge < 5 * 60_000);
    const err = errMap.get(key);
    const errRecent = !!err?.busyAt && now.getTime() - err.busyAt.getTime() < 24 * 3_600_000;
    const status = !configured
      ? { label: "não configurado", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" }
      : busyFresh
        ? { label: "sincronizando", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" }
        : !active
          ? { label: "parado", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" }
          : errRecent
            ? { label: "com erro", cls: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" }
            : { label: "ativo", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" };
    return { key, name: SYNC_SOURCES[key], status, lastBeat: beatAt, err: errRecent ? err!.phase : null };
  });

  const workflows = (ghWorkflows?.workflows ?? []) as { name: string; state: string; path: string }[];
  const runs = (ghRuns?.workflow_runs ?? []) as GhRun[];

  const services = [
    { name: "Site (ofertacoradar.com.br)", check: site, note: `${site.ms}ms` },
    { name: "Chatwoot (chat.)", check: chat, note: `${chat.ms}ms` },
    { name: "Supabase Auth API", check: supaAuth, note: supaAuth.status ? `HTTP ${supaAuth.status}` : "" },
    { name: "Supabase REST API", check: supaRest, note: supaRest.status ? `HTTP ${supaRest.status}` : "" },
    {
      name: "GitHub Actions",
      check: { ok: ghWorkflows !== null, ms: 0 },
      note: workflows.filter((w) => w.state === "active").length + "/" + workflows.length + " workflows ativos",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Painel</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Serviços</h1>
          <p className="mt-1 text-sm text-zinc-500">Monitoramento interno e externo — {now.toLocaleString("pt-BR")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-bold shadow-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
          >
            ← Admin
          </Link>
          <Link
            href="/"
            className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-bold shadow-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900"
          >
            ← Site
          </Link>
        </div>
      </header>

      {/* Serviços externos */}
      <div className="mb-8">
        <Card title="Serviços externos">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div key={s.name} className="flex items-center justify-between rounded-xl border border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-extrabold">{s.name}</p>
                  {s.check.error && <p className="text-xs text-red-500">{s.check.error.slice(0, 60)}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">{s.note}</span>
                  <Badge ok={s.check.ok} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-400">
            cron-job.org não tem API pública — a prova de que os 4 jobs disparam é o heartbeat dos syncs abaixo
            (sync a cada 1min) e os runs do GitHub Actions. Healthchecks.io: kit diário pinga sozinho.
          </p>
        </Card>
      </div>

      {/* GitHub Actions */}
      <div className="mb-8">
        <Card title="GitHub Actions — workflows e últimos runs">
          <div className="mb-4 flex flex-wrap gap-2">
            {workflows.map((w) => (
              <span
                key={w.path}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  w.state === "active"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                }`}
              >
                {w.name} · {w.state}
              </span>
            ))}
            {workflows.length === 0 && <p className="text-sm text-zinc-400">API do GitHub indisponível.</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            {runs.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800">
                <span className="font-semibold">{r.name}</span>
                <span className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>{r.event}</span>
                  <span>{timeAgo(new Date(r.created_at), now)}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-extrabold uppercase ${
                      r.conclusion === "success"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : r.status !== "completed"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    }`}
                  >
                    {r.status === "completed" ? r.conclusion : r.status}
                  </span>
                </span>
              </div>
            ))}
            {runs.length === 0 && <p className="text-sm text-zinc-400">Nenhum run recente.</p>}
          </div>
        </Card>
      </div>

      {/* Banco de dados */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card title={`Banco de dados — ${dbPct.toFixed(1)}% de ${DB_LIMIT_MB} MB`}>
          <div
            className={`mb-4 rounded-xl px-4 py-3 text-center text-2xl font-black ${
              dbPct > 80
                ? "bg-red-50 text-red-600 dark:bg-red-950/40"
                : dbPct > 60
                  ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40"
            }`}
          >
            {dbMB.toFixed(1)} MB
          </div>
          <div className="flex flex-col gap-1.5">
            {tables.map((t) => (
              <div key={t.tabela} className="flex justify-between text-sm">
                <span className="font-semibold">{t.tabela}</span>
                <span className="tabular-nums text-zinc-500">{(Number(t.bytes) / 1048576).toFixed(1)} MB</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Produtos por fonte">
          <div className="flex flex-col gap-2.5">
            {bySource.map((s) => (
              <div key={s.fonte} className="flex items-center justify-between rounded-xl border border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
                <span className="text-sm font-extrabold">{s.fonte}</span>
                <span className="text-xs text-zinc-500">
                  {Number(s.n).toLocaleString("pt-BR")} produtos · atualizado {timeAgo(s.last, now)}
                </span>
              </div>
            ))}
            <div className="mt-2 flex flex-wrap gap-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
              <span>Subscribers: <b>{subsTotal.toLocaleString("pt-BR")}</b></span>
              <span>Links mortos bloqueados (tombstone): <b>{deadLinks.toLocaleString("pt-BR")}</b></span>
              <span>Kit enviado: <b>{kitRow ? "sim" : "não"}</b></span>
            </div>
          </div>
        </Card>
      </div>

      {/* Syncs internos */}
      <Card title="Sincronização das fontes (syncers internos)">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {syncRows.map((s) => (
            <div key={s.key} className="rounded-xl border border-zinc-100 p-3 text-sm dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="font-extrabold">{s.name}</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${s.status.cls}`}>
                  {s.status.label}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">último pulso: {timeAgo(s.lastBeat, now)}</p>
              {s.err && <p className="mt-1 text-xs font-semibold text-orange-600 dark:text-orange-400">erro: {s.err}</p>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
