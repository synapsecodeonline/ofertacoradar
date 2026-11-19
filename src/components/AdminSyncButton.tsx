"use client";

import { useState } from "react";

export default function AdminSyncButton() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function run() {
    setState("loading");
    try {
      const r = await fetch("/api/admin/sync", { method: "POST" });
      setState(r.ok ? "done" : "error");
      setTimeout(() => setState("idle"), 4000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  const label =
    state === "loading"
      ? "Sincronizando…"
      : state === "done"
        ? "Sync iniciado ✓"
        : state === "error"
          ? "Falhou"
          : "Sincronizar agora";

  return (
    <button
      type="button"
      onClick={run}
      disabled={state === "loading"}
      className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
    >
      {label}
    </button>
  );
}
