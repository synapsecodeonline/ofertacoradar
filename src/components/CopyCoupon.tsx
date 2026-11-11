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
      className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-emerald-500 bg-emerald-50 px-4 py-2 font-mono text-lg font-bold tracking-widest text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
    >
      {code}
      <span className="text-sm font-sans font-medium">
        {copied ? "Copiado!" : "copiar"}
      </span>
    </button>
  );
}
