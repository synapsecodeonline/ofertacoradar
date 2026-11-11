"use client";

import { useState } from "react";

export default function CopyCoupon({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={copy}
      aria-label={copied ? "Cupom copiado" : `Copiar cupom ${code}`}
      className={`group inline-flex w-fit items-center gap-3 rounded-xl border-2 border-dashed px-5 py-3 font-mono text-lg font-bold tracking-widest transition-all ${
        copied
          ? "border-emerald-500 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "border-amber-400/70 bg-amber-50 text-amber-800 hover:border-amber-500 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
      }`}
    >
      {code}
      <span
        className={`rounded-md px-2 py-0.5 font-sans text-xs font-bold transition-colors ${
          copied
            ? "bg-emerald-600 text-white"
            : "bg-zinc-900/10 text-zinc-500 group-hover:bg-zinc-900/15 dark:bg-white/10 dark:text-zinc-300"
        }`}
      >
        {copied ? "Copiado!" : "copiar"}
      </span>
    </button>
  );
}
