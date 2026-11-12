"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface CategoryItem {
  slug: string;
  label: string;
  href: string;
  active: boolean;
}

// Cor pastel por categoria (hash do slug -> hue), avatar com inicial
function hueOf(slug: string): number {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export default function CategoryNav({ items }: { items: CategoryItem[] }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const active = items.find((i) => i.active);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fecha ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  if (items.length <= 1) return null;

  return (
    <div
      ref={wrapRef}
      className={`sticky top-14 z-[5] -mx-4 border-b backdrop-blur-xl transition-all duration-300 ${
        scrolled || open
          ? "border-zinc-200/70 bg-white/85 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] dark:border-zinc-800/70 dark:bg-zinc-950/85"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-3 px-4">
        {/* Botao Categorias */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`group inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            open
              ? "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
              : "border-zinc-200 bg-white/70 text-zinc-700 hover:border-emerald-400 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:border-emerald-600"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-90" : ""}`}
          >
            <path d="M4 6h16M4 12h16M4 18h10" />
          </svg>
          Categorias
          <span
            className={`rounded-full px-1.5 py-px text-[10px] font-extrabold transition-colors ${
              open ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            }`}
          >
            {items.length - 1}
          </span>
        </button>

        {/* Categoria ativa */}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {active && active.slug ? (
            <>
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: `hsl(${hueOf(active.slug)} 70% 45%)` }}
              />
              <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {active.label}
              </span>
              <Link
                href={items[0]?.href ?? "/"}
                onClick={close}
                className="shrink-0 text-xs font-medium text-zinc-400 underline-offset-2 transition-colors hover:text-emerald-600 hover:underline"
              >
                ver todas
              </Link>
            </>
          ) : (
            <span className="text-sm font-medium text-zinc-400">
              Todas as categorias
            </span>
          )}
        </div>

        {/* Chevron (botao que alterna o painel) */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Recolher categorias" : "Expandir categorias"}
          aria-expanded={open}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-all duration-300 hover:bg-zinc-100 hover:text-emerald-600 dark:hover:bg-zinc-800"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-4 w-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* Painel expansivel (altura animada via grid-rows) */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-zinc-200/60 px-4 pb-4 pt-3 dark:border-zinc-800/60">
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {items.map((c) => {
                const hue = hueOf(c.slug || "todas");
                return (
                  <Link
                    key={c.slug}
                    href={c.href}
                    onClick={close}
                    className={`group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all duration-200 ${
                      c.active
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                        : "border-zinc-200/80 bg-white/60 text-zinc-700 hover:-translate-y-px hover:border-emerald-300 hover:bg-white hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:border-emerald-700 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold transition-colors ${
                        c.active
                          ? "bg-white/20 text-white"
                          : "text-white"
                      }`}
                      style={
                        c.active
                          ? undefined
                          : {
                              backgroundColor: `hsl(${hue} 65% 45%)`,
                            }
                      }
                    >
                      {c.label.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate text-[13px] font-semibold">
                      {c.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
