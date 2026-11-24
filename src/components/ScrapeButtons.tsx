"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ScrapeButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});

  const run = async (src: "ml" | "amz") => {
    setBusy(src);
    setMsg((m) => ({ ...m, [src]: "enfileirando…" }));
    try {
      const r = await fetch("/api/admin/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src }),
      });
      const j = await r.json().catch(() => ({}));
      setMsg((m) => ({
        ...m,
        [src]: r.ok ? "na fila — roda em até 1min" : j.error ?? "falhou",
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
    <div className="flex flex-wrap items-center gap-2">
      <button className={btn} disabled={busy !== null} onClick={() => run("ml")}>
        {busy === "ml" ? "…" : "Rodar scrape ML"}
      </button>
      <button className={btn} disabled={busy !== null} onClick={() => run("amz")}>
        {busy === "amz" ? "…" : "Rodar scrape Amazon"}
      </button>
      {Object.entries(msg).map(([k, v]) => (
        <span key={k} className="text-xs text-zinc-500">
          {k === "ml" ? "ML" : "Amazon"}: {v}
        </span>
      ))}
    </div>
  );
}
