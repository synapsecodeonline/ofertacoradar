"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ReqState = { at?: string; status?: string } | null;
type LastState = {
  at?: string;
  ok?: boolean;
  erro?: string;
  novos?: number;
  gravados?: number;
  atualizados?: number;
  ativos?: number;
  total?: number;
} | null;
type Status = {
  requests: { ml: ReqState; amz: ReqState };
  last: { ml: LastState; amz: LastState };
};

type Phase = "idle" | "queued" | "running" | "done" | "fail";

const POLL_MS = 12_000;

// Palavras-chave (virgula) + quantidade viram --queries/--max-new no
// scrape. Depois de enfileirar, faz polling no GET /api/admin/scrape
// ate o pedido sumir e o resultado (scrape:{src}) chegar — ai mostra
// se cadastrou produtos e da refresh no card.
export default function ScrapeButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [kw, setKw] = useState("");
  const [maxNew, setMaxNew] = useState("");
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const reqAt = useRef<Record<string, number>>({}); // ts do pedido visto
  const gonePolls = useRef<Record<string, number>>({});

  const parseKw = () =>
    kw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);

  const summarize = (l: LastState) => {
    if (!l) return "sem dados";
    const parts: string[] = [];
    const novos = l.novos ?? l.gravados;
    if (typeof novos === "number") parts.push(`${novos} novo(s)`);
    if (typeof l.atualizados === "number") parts.push(`${l.atualizados} atualizado(s)`);
    if (typeof l.ativos === "number") parts.push(`${l.ativos} ativos`);
    return parts.length ? parts.join(" · ") : l.ok ? "concluído" : "falhou";
  };

  const phaseRef = useRef<Record<string, Phase>>({});
  const msgRef = useRef<Record<string, string>>({});

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/scrape", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as Status;
      let needRefresh = false;

      for (const src of ["ml", "amz"] as const) {
        const req = j.requests[src];
        const last = j.last[src];
        const cur = phaseRef.current[src] ?? "idle";
        let next: Phase | null = null;
        let nextMsg: string | null = null;

        if (req) {
          // pedido existe: fila ou rodando
          const at = req.at ? new Date(req.at).getTime() : Date.now();
          if (!reqAt.current[src] || at > reqAt.current[src]) {
            reqAt.current[src] = at;
            gonePolls.current[src] = 0;
          }
          const st = req.status === "running" ? "running" : "queued";
          next = st;
          nextMsg =
            st === "running"
              ? "rodando… (pode levar vários minutos)"
              : "na fila — dispatcher pega em até 1min";
        } else {
          // pedido sumiu: resultado deve ter chegado em scrape:{src}
          const reqTs = reqAt.current[src];
          const lastTs = last?.at ? new Date(last.at).getTime() : 0;
          if (reqTs && lastTs >= reqTs) {
            const ok = last?.ok !== false;
            next = ok ? "done" : "fail";
            nextMsg = ok
              ? `concluído — ${summarize(last)}`
              : `falhou — ${last?.erro?.slice(0, 120) ?? "ver logs"}`;
            delete reqAt.current[src];
          } else if (reqTs) {
            // pedido sumiu sem reporte ainda — tolera 2 polls (~24s)
            gonePolls.current[src] = (gonePolls.current[src] ?? 0) + 1;
            if (gonePolls.current[src] >= 2) {
              next = "fail";
              nextMsg = "finalizou sem reporte — veja logs do scrape";
              delete reqAt.current[src];
            } else {
              next = cur === "idle" ? "queued" : cur;
              nextMsg = "aguardando resultado…";
            }
          }
          // sem pedido rastreado: mantem fase/mensagem atuais
        }

        if (
          next !== null &&
          (next !== cur || (nextMsg !== null && nextMsg !== msgRef.current[src]))
        ) {
          phaseRef.current[src] = next;
          setPhase((p) => ({ ...p, [src]: next }));
          if (nextMsg !== null) {
            msgRef.current[src] = nextMsg;
            setMsg((m) => ({ ...m, [src]: nextMsg }));
          }
          needRefresh = true;
        }
      }

      if (needRefresh) router.refresh();
    } catch {
      /* offline — proximo poll tenta de novo */
    }
  }, [router]);

  // polling continuo: cobre pedido feito aqui E pedido de outra
  // sessao/cron — so trabalha enquanto houver algo em andamento
  useEffect(() => {
    const iv = setInterval(poll, POLL_MS);
    poll();
    return () => clearInterval(iv);
  }, [poll]);

  const run = async (src: "ml" | "amz") => {
    const queries = parseKw();
    const n = Math.floor(Number(maxNew));
    const max = Number.isFinite(n) && n >= 1 && n <= 500 ? n : null;
    setBusy(src);
    setMsg((m) => ({ ...m, [src]: "enfileirando…" }));
    try {
      const r = await fetch("/api/admin/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          src,
          ...(queries.length ? { queries } : {}),
          ...(max ? { maxNew: max } : {}),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        // ja marca como na fila — o proximo poll confirma
        phaseRef.current[src] = "queued";
        setPhase((p) => ({ ...p, [src]: "queued" }));
        const m = queries.length
          ? `${queries.length} palavra(s)-chave enfileirada(s)`
          : "enfileirado";
        msgRef.current[src] = m;
        setMsg((mm) => ({ ...mm, [src]: m }));
        reqAt.current[src] = Date.now();
        gonePolls.current[src] = 0;
      } else {
        phaseRef.current[src] = "fail";
        setPhase((p) => ({ ...p, [src]: "fail" }));
        const m = j.error ?? "falhou";
        msgRef.current[src] = m;
        setMsg((mm) => ({ ...mm, [src]: m }));
      }
      router.refresh();
    } catch {
      setMsg((m) => ({ ...m, [src]: "erro de rede" }));
    } finally {
      setBusy(null);
    }
  };

  const btn =
    "rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50";

  const msgColor = (src: string) =>
    phase[src] === "done"
      ? "text-emerald-600 dark:text-emerald-400"
      : phase[src] === "fail"
        ? "text-red-600 dark:text-red-400"
        : phase[src] === "running"
          ? "text-amber-600 dark:text-amber-400"
          : "text-zinc-500";

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={kw}
        onChange={(e) => setKw(e.target.value)}
        placeholder="Palavras-chave (ex: airfryer, ps5, manga, cafeteira) — vazio = lista padrão"
        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} disabled={busy !== null} onClick={() => run("ml")}>
          {busy === "ml" ? "…" : "Rodar scrape ML"}
        </button>
        <button className={btn} disabled={busy !== null} onClick={() => run("amz")}>
          {busy === "amz" ? "…" : "Rodar scrape Amazon"}
        </button>
        {kw.trim() && (
          <span className="text-xs text-zinc-500">
            {parseKw().length} palavra(s)-chave
          </span>
        )}
        <input
          type="number"
          min={1}
          max={500}
          value={maxNew}
          onChange={(e) => setMaxNew(e.target.value)}
          placeholder="Qtd. produtos"
          title="Máximo de produtos novos a cadastrar nesta rodada (1–500, vazio = padrão do scraper)"
          className="w-32 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {Object.entries(msg).map(([k, v]) => (
        <span key={k} className={`text-xs font-semibold ${msgColor(k)}`}>
          {k === "ml" ? "ML" : "Amazon"}: {v}
        </span>
      ))}
    </div>
  );
}
