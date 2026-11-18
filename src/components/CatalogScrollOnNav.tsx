"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const FLAG = "of_scroll_hash";

function scrollToHash(hash: string) {
  const el = document.getElementById(hash);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const FLAG_TTL_MS = 15_000;

function consumeFlag(): string | null {
  try {
    const raw = sessionStorage.getItem(FLAG);
    sessionStorage.removeItem(FLAG);
    if (!raw) return null;
    // formato "hash:timestamp" — ignora flags velhas (nav nao relacionada)
    const i = raw.lastIndexOf(":");
    const hash = i > 0 ? raw.slice(0, i) : raw;
    const ts = i > 0 ? Number(raw.slice(i + 1)) : 0;
    if (ts && Date.now() - ts > FLAG_TTL_MS) return null;
    return hash;
  } catch {
    return null;
  }
}

/** Deixa a flag para o CatalogScrollOnNav rolar apos a navegacao. */
export function markScrollTo(hash: string) {
  try {
    sessionStorage.setItem(FLAG, `${hash}:${Date.now()}`);
  } catch {}
}

/**
 * Montado uma vez na home. Rola ate o hash em dois momentos:
 * 1) no mount — cobre cliques vindos de OUTRA pagina (ex.: header em
 *    /produto/x -> /?aba=ml#catalogo), quando os params nao "mudam"
 *    dentro desta pagina;
 * 2) quando searchParams mudam — cobre navegacao client-side dentro da
 *    home, que comita DEPOIS do clique (o reset de scroll do Next nao
 *    apaga mais a rolagem porque ela acontece pos-commit).
 */
export default function CatalogScrollOnNav() {
  const params = useSearchParams();
  const key = params.toString();
  const prev = useRef(key);

  useEffect(() => {
    const hash = consumeFlag();
    if (!hash) return;
    scrollToHash(hash);
    const t = setTimeout(() => scrollToHash(hash), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prev.current === key) return;
    prev.current = key;
    const hash = consumeFlag();
    if (!hash) return;
    scrollToHash(hash);
    const t1 = setTimeout(() => scrollToHash(hash), 300);
    const t2 = setTimeout(() => scrollToHash(hash), 800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [key]);

  return null;
}
