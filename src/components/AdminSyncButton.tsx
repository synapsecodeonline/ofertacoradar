"use client";

import { useState } from "react";

type SourceStatus = "started" | "busy" | "skipped";

const SOURCE_LABEL: Record<string, string> = {
  lomadee: "Lomadee",
  ml: "Mercado Livre",
  awin: "Awin",
};

const STATUS_TEXT: Record<SourceStatus, string> = {
  started: "iniciada",
  busy: "já rodando",
  skipped: "indisponível",
};

export default function AdminSyncButton() {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "done"; sources: { source: string; status: SourceStatus }[] }
    | { kind: "error"; msg: string }
  >({ kind: "idle" });

  async function run() {
    setState({ kind: "loading" });
    try {
      const r = await fetch("/api/admin/sync", { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as {
        sources?: { source: string; status: SourceStatus }[];
        error?: string;
      };
      if (!r.ok) {
        setState({ kind: "error", msg: j.error ?? `HTTP ${r.status}` });
      } else {
        setState({ kind: "done", sources: j.sources ?? [] });
      }
    } catch {
      setState({ kind: "error", msg: "falha de rede" });
    }
    setTimeout(() => setState({ kind: "idle" }), 10_000);
  }

  const label =
    state.kind === "loading"
      ? "Sincronizando…"
      : state.kind === "done"
        ? "Sync disparado ✓"
        : state.kind === "error"
          ? "Falhou"
          : "Sincronizar agora";

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={state.kind === "loading"}
        className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        {label}
      </button>
      {state.kind === "done" && (
        <span className="text-right text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          {state.sources.map((s) => (
            <span key={s.source} className="mr-2 inline-block">
              {SOURCE_LABEL[s.source] ?? s.source}:{" "}
              <strong
                className={
                  s.status === "started"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : s.status === "busy"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-zinc-400"
                }
              >
                {STATUS_TEXT[s.status]}
              </strong>
            </span>
          ))}
        </span>
      )}
      {state.kind === "error" && (
        <span className="text-right text-[11px] font-medium text-red-500">
          {state.msg}
        </span>
      )}
    </span>
  );
}
