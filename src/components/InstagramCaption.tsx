"use client";

import { useState } from "react";

export default function InstagramCaption({ caption }: { caption: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = caption;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-pink-200/70 dark:border-pink-900/50">
      <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 px-4 py-2.5">
        <p className="text-xs font-bold uppercase tracking-wide text-white">
          Legenda pronta para o Instagram
        </p>
      </div>
      <div className="bg-white px-4 py-3 dark:bg-zinc-900">
        <p className="max-h-36 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
          {caption}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[10px] text-zinc-400">
            {caption.length}/2200 caracteres
          </span>
          <button
            onClick={copy}
            className={`inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all ${
              copied
                ? "bg-emerald-600 text-white"
                : "bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:from-pink-600 hover:to-rose-600"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copied ? "Legenda copiada!" : "Copiar legenda"}
          </button>
        </div>
      </div>
    </div>
  );
}
