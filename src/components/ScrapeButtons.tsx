"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Palavras-chave (separadas por virgula) viram --queries no scrape —
// rodada direcionada so com os produtos que o usuario quer.
export default function ScrapeButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [kw, setKw] = useState("");
  const [maxNew, setMaxNew] = useState("");

  const parseKw = () =>
    kw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);

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
      setMsg((m) => ({
        ...m,
        [src]: r.ok
          ? queries.length
            ? `${queries.length} palavra(s)-chave na fila — roda em até 1min`
            : "na fila — roda em até 1min"
          : j.error ?? "falhou",
      }));
      router.refresh();
    } catch {
      setMsg((m) => ({ ...m, [src]: "erro de rede" }));
    } finally {
      setBusy(null);
    }
  };

  const btn =
    "rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50";

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
        <span key={k} className="text-xs text-zinc-500">
          {k === "ml" ? "ML" : "Amazon"}: {v}
        </span>
      ))}
    </div>
  );
}
