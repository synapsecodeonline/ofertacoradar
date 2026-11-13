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
          className="group flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-2">{title}</span>
          <span className="flex shrink-0 items-center gap-2">
            {meta}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-4 w-4 text-zinc-400 transition-transform duration-300 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 ${
                open ? "rotate-180" : ""
              }`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
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
