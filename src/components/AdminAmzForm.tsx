"use client";

import { useState } from "react";

// Formulario de cadastro manual de produtos Amazon no /admin.
// Cola o link do produto -> "Buscar" tenta ler os dados na pagina
// da Amazon -> confere/edita -> "Adicionar" publica no catalogo
// com o Partner Tag (comissao garantida sem API).
export default function AdminAmzForm() {
  const [input, setInput] = useState("");
  const [asin, setAsin] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState<"lookup" | "add" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function lookup() {
    setBusy("lookup");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/amz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "lookup", input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Erro ao buscar" });
        return;
      }
      setAsin(data.asin);
      setTitle(data.title ?? "");
      setPrice(data.price != null ? String(data.price) : "");
      setOldPrice(data.oldPrice != null ? String(data.oldPrice) : "");
      setImageUrl(data.imageUrl ?? "");
      setMsg(
        data.error
          ? { ok: false, text: data.error }
          : { ok: true, text: "Dados encontrados — confira e adicione." },
      );
    } catch {
      setMsg({ ok: false, text: "Falha de rede" });
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    setBusy("add");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/amz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "add",
          asin,
          title,
          price: price ? Number(price.replace(",", ".")) : null,
          oldPrice: oldPrice ? Number(oldPrice.replace(",", ".")) : null,
          imageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Erro ao adicionar" });
        return;
      }
      setMsg({
        ok: true,
        text: `Produto #${data.id} adicionado — já aparece na aba Amazon.`,
      });
      setInput("");
      setAsin("");
      setTitle("");
      setPrice("");
      setOldPrice("");
      setImageUrl("");
    } catch {
      setMsg({ ok: false, text: "Falha de rede" });
    } finally {
      setBusy(null);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          className={inputCls}
          placeholder="Cole o link ou ASIN do produto na Amazon"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
        />
        <button
          onClick={lookup}
          disabled={busy !== null || !input.trim()}
          className="shrink-0 rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === "lookup" ? "Buscando…" : "Buscar"}
        </button>
      </div>

      {(asin || title) && (
        <div className="flex flex-col gap-2 rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className={inputCls} placeholder="URL da imagem" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            <input className={inputCls} placeholder="Preço (ex: 199,90)" value={price} onChange={(e) => setPrice(e.target.value)} />
            <input className={inputCls} placeholder="Preço antigo (opcional)" value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} />
          </div>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-24 w-24 rounded-lg border object-contain" />
          )}
          <button
            onClick={add}
            disabled={busy !== null || !title.trim() || !imageUrl.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy === "add" ? "Adicionando…" : "Adicionar ao site"}
          </button>
        </div>
      )}

      {msg && (
        <p className={`text-xs font-semibold ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>
          {msg.text}
        </p>
      )}
      <p className="text-[11px] text-zinc-400">
        Enquanto a API da Amazon não é liberada, cadastre produtos manualmente aqui.
        O link de saída já sai com sua tag de associado.
      </p>
    </div>
  );
}
