"use client";

import { useState, type ReactNode } from "react";

/**
 * Seção retrátil no estilo do CategoryNav: cabeçalho clicável com
 * chevron animado (grid-rows), aberta por padrão.
 */
export default function CollapsibleSection({
  id,
  title,
  meta,
  className = "",
  defaultOpen = true,
  children,
}: {
  id?: string;
  title: ReactNode;
  meta?: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      id={id}
      className={`mb-6 -mx-4 scroll-mt-20 rounded-2xl border px-4 py-4 ${className}`}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="group flex w-full cursor-pointer items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-2">{title}</span>
          <span className="flex shrink-0 items-center gap-2">
            {meta}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300/80 bg-white/80 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 shadow-sm transition-all duration-200 group-hover:-translate-y-px group-hover:border-zinc-400 group-hover:text-zinc-800 group-hover:shadow dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-400 dark:group-hover:border-zinc-500 dark:group-hover:text-zinc-200">
              {open ? "Recolher" : "Expandir"}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`h-3 w-3 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </span>
        </button>

        <div
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
