"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { IconSearch } from "@/components/Icons";

export default function SearchBar({
  merchants,
  currentMerchant,
}: {
  merchants: string[];
  currentMerchant: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const go = (p: URLSearchParams) => {
    p.delete("pagina");
    const s = p.toString();
    router.push(s ? `/?${s}` : "/", { scroll: false });
  };

  return (
    <form
      action="/"
      method="get"
      className="mt-5 flex w-full max-w-2xl flex-col gap-2 rounded-2xl border border-zinc-200/80 bg-white p-2 shadow-lg shadow-zinc-900/5 sm:flex-row dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20"
    >
      <input type="hidden" name="aba" value={params.get("aba") ?? "produtos"} />
      {params.get("categoria") && (
        <input type="hidden" name="categoria" value={params.get("categoria")!} />
      )}
      {params.get("ordem") && (
        <input type="hidden" name="ordem" value={params.get("ordem")!} />
      )}
      <div className="relative flex-1">
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="Buscar produtos, lojas ou cupons..."
          className="h-11 w-full rounded-xl bg-zinc-50 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-emerald-500/40 dark:bg-zinc-950 dark:focus:bg-zinc-900"
        />
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
          className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium outline-none transition-colors focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950"
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
      <button
        type="submit"
        className="h-11 rounded-xl bg-emerald-600 px-6 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md active:scale-[0.98]"
      >
        Buscar
      </button>
    </form>
  );
}
