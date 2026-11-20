"use client";

import { useState } from "react";

export default function NotifyForm({ productId }: { productId: number }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ok" | "err">(
    "idle",
  );
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setMsg("");
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, productId }),
      });
      const data = await res.json();
      if (data.ok) {
        setState("ok");
        setMsg("Pronto! Avisamos você se o preço baixar.");
      } else {
        setState("err");
        setMsg(data.error ?? "Não foi possível salvar agora.");
      }
    } catch {
      setState("err");
      setMsg("Erro de conexão. Tente de novo.");
    }
  }

  if (state === "ok") {
    return (
      <p
        role="status"
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
      >
        {msg}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">
        🔔 Avise-me se o preço baixar
      </p>
      <div className="flex gap-2">
        <label htmlFor="notify-email" className="sr-only">
          Seu e-mail
        </label>
        <input
          id="notify-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {state === "loading" ? "..." : "Avisar"}
        </button>
      </div>
      {state === "err" && (
        <p role="alert" className="text-xs font-semibold text-red-600">
          {msg}
        </p>
      )}
    </form>
  );
}
