"use client";

import { useEffect } from "react";

/** Garante que a pagina abra no topo (scroll restoration do navegador/Next
 *  as vezes mantem a posicao da pagina anterior em rotas dinamicas). */
export default function ScrollToTop() {
  useEffect(() => {
    window.scrollTo(0, 0);
    // segunda tentativa apos imagens/fontes assentarem o layout
    const t = setTimeout(() => window.scrollTo(0, 0), 300);
    return () => clearTimeout(t);
  }, []);
  return null;
}
