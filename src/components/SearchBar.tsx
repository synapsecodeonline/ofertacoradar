"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconSearch } from "@/components/Icons";
import { scrollToCatalogOnNav } from "@/components/HashLink";

type Suggest = {
  products: {
    id: number;
    title: string;
    price: number | null;
    imageUrl: string | null;
    merchant: string | null;
    discountPct: number | null;
  }[];
  merchants: string[];
};

const ORDENS: [string, string][] = [
  ["", "Ordenar: ofertas"],
  ["desconto", "Maior desconto"],
  ["menor-preco", "Menor preço"],
  ["maior-preco", "Maior preço"],
  ["recentes", "Mais recentes"],
];

export default function SearchBar({
  merchants,
  currentMerchant,
}: {
  merchants: string[];
  currentMerchant: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [sug, setSug] = useState<Suggest | null>(null);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>(null);

  const go = (p: URLSearchParams) => {
    p.delete("pagina");
    const s = p.toString();
    router.push(s ? `/?${s}` : "/", { scroll: false });
    scrollToCatalogOnNav();
  };

  // Autocomplete: debounce 250ms, minimo 2 chars
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const term = q.trim();
    if (term.length < 2) {
      setSug(null);
      setOpen(false);
      return;
    }
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        if (!r.ok) return;
        const data = (await r.json()) as Suggest;
        setSug(data);
        setOpen(true);
        setHi(-1);
      } catch {
        /* silencioso */
      }
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pickProduct = (id: number) => {
    setOpen(false);
    router.push(`/produto/${id}`);
  };
  const pickMerchant = (m: string) => {
    const p = new URLSearchParams(params.toString());
    p.set("loja", m);
    p.delete("pagina");
    p.delete("q");
    go(p);
  };

  const flatItems = [
    ...(sug?.merchants.map((m) => ({ type: "m" as const, m })) ?? []),
    ...(sug?.products.map((p) => ({ type: "p" as const, p })) ?? []),
  ];

  return (
    <form
      action="/"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const p = new URLSearchParams();
        for (const [k, v] of data.entries()) {
          if (typeof v === "string" && v) p.set(k, v);
        }
        p.delete("pagina");
        const s = p.toString();
        router.push(s ? `/?${s}` : "/", { scroll: false });
        setOpen(false);
        scrollToCatalogOnNav();
      }}
      className="mt-5 flex w-full max-w-2xl flex-col gap-2 rounded-2xl border border-zinc-200/80 bg-white p-2 shadow-lg shadow-zinc-900/5 sm:flex-row dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20"
    >
      <input type="hidden" name="aba" value={params.get("aba") ?? ""} />
      {params.get("categoria") && (
        <input type="hidden" name="categoria" value={params.get("categoria")!} />
      )}
      {params.get("tipo") && (
        <input type="hidden" name="tipo" value={params.get("tipo")!} />
      )}
      <div className="relative flex-1" ref={boxRef}>
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <label htmlFor="busca-produtos" className="sr-only">
          Buscar produtos, lojas ou cupons
        </label>
        <input
          id="busca-produtos"
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (!open || flatItems.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((h) => (h + 1) % flatItems.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => (h - 1 + flatItems.length) % flatItems.length);
            } else if (e.key === "Enter" && hi >= 0) {
              e.preventDefault();
              const it = flatItems[hi];
              if (it.type === "p") pickProduct(it.p.id);
              else pickMerchant(it.m);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Buscar produtos, lojas ou cupons..."
          className="h-11 w-full rounded-xl bg-zinc-50 pl-10 pr-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/40 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:bg-zinc-900"
          role="combobox"
          aria-expanded={open}
          aria-controls="busca-sugestoes"
          aria-autocomplete="list"
        />
        {open && sug && (sug.products.length > 0 || sug.merchants.length > 0) && (
          <ul
            id="busca-sugestoes"
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
          >
            {sug.merchants.length > 0 && (
              <li className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
                Lojas
              </li>
            )}
            {sug.merchants.map((m) => (
              <li key={`m-${m}`}>
                <button
                  type="button"
                  onClick={() => pickMerchant(m)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-zinc-700 hover:bg-emerald-50 dark:text-zinc-200 dark:hover:bg-emerald-950/40"
                >
                  <span className="truncate">{m}</span>
                  <span className="ml-auto text-[10px] font-bold uppercase text-zinc-400">
                    loja
                  </span>
                </button>
              </li>
            ))}
            {sug.products.length > 0 && (
              <li className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">
                Produtos
              </li>
            )}
            {sug.products.map((p) => (
              <li key={`p-${p.id}`}>
                <button
                  type="button"
                  onClick={() => pickProduct(p.id)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-lg bg-zinc-100 object-contain dark:bg-zinc-800"
                    />
                  ) : (
                    <span className="h-9 w-9 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {p.title}
                    </span>
                    <span className="block truncate text-[11px] text-zinc-500">
                      {p.merchant}
                      {p.discountPct ? ` · -${p.discountPct}%` : ""}
                    </span>
                  </span>
                  {p.price != null && (
                    <span className="shrink-0 text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                      R$ {p.price.toFixed(2).replace(".", ",")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {merchants.length > 1 && (
        <select
          name="loja"
          defaultValue={currentMerchant}
          onChange={(e) => {
            const p = new URLSearchParams(params.toString());
            if (e.target.value) p.set("loja", e.target.value);
            else p.delete("loja");
            go(p);
          }}
          className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-900 outline-none transition-colors focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          aria-label="Filtrar por loja"
        >
          <option value="">Todas as lojas</option>
          {merchants.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      )}
      <select
        name="ordem"
        defaultValue={params.get("ordem") ?? ""}
        onChange={(e) => {
          const p = new URLSearchParams(params.toString());
          if (e.target.value) p.set("ordem", e.target.value);
          else p.delete("ordem");
          go(p);
        }}
        className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-900 outline-none transition-colors focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        aria-label="Ordenar resultados"
      >
        {ORDENS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="h-11 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md active:scale-[0.98]"
      >
        Buscar
      </button>
    </form>
  );
}
