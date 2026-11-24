"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Barra de progresso indeterminada: aparece ao clicar em link interno
// ou enviar formulario GET (busca/filtros) e some quando a pagina nova
// TERMINA de renderizar — nao no commit da navegacao. As paginas sao
// SSR com streaming: o pathname muda quando o shell commita, mas o
// HTML do banco continua chegando depois — esconder ali fazia a barra
// sumir antes do conteudo aparecer.
function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const pendingNav = useRef(false); // clique aconteceu, aguardando commit
  const startedAt = useRef(0);

  const hide = () => {
    pendingNav.current = false;
    setLoading(false);
  };

  useEffect(() => {
    const maybeStart = (e: Event) => {
      const me = e as MouseEvent;
      // ctrl/cmd/shift/alt+click abre em nova aba — pagina atual nao navega
      if (me.metaKey || me.ctrlKey || me.shiftKey || me.altKey) return;

      let url: URL | null = null;
      if (e.type === "click") {
        const a = (e.target as HTMLElement | null)?.closest?.("a");
        if (!a || a.target === "_blank") return;
        const href = a.getAttribute("href");
        if (!href || href.startsWith("#")) return;
        try {
          url = new URL(href, window.location.href);
        } catch {
          return;
        }
      } else {
        const f = e.target;
        if (!(f instanceof HTMLFormElement)) return;
        if ((f.method || "get").toLowerCase() !== "get") return;
        try {
          url = new URL(
            f.getAttribute("action") || window.location.href,
            window.location.href,
          );
        } catch {
          return;
        }
      }
      if (!url || url.origin !== window.location.origin) return;
      // mesma pagina (so hash ou nada muda): nao ha fetch de servidor
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;
      startedAt.current = Date.now();
      pendingNav.current = true;
      setLoading(true);
    };
    document.addEventListener("click", maybeStart);
    document.addEventListener("submit", maybeStart);
    return () => {
      document.removeEventListener("click", maybeStart);
      document.removeEventListener("submit", maybeStart);
    };
  }, []);

  // Commit da navegacao (pathname/search mudou DEPOIS do clique): o
  // shell novo ja esta no DOM, mas o streaming do SSR pode continuar.
  // Observa mutacoes e so esconde quando o DOM ficar quieto — assim a
  // barra cobre o tempo real de renderizacao da pagina.
  useEffect(() => {
    if (!pendingNav.current) return;
    pendingNav.current = false;

    let settleTimer: ReturnType<typeof setTimeout>;
    const armSettle = () => {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(hide, 500);
    };

    // tempo minimo visivel — evita flash em navegacao instantanea
    const minVisible = Math.max(0, 800 - (Date.now() - startedAt.current));

    const obs = new MutationObserver(() => armSettle());
    obs.observe(document.body, { childList: true, subtree: true });
    // se o DOM ja esta quieto, esconde apos minVisible + 500ms de folga
    const quiet = setTimeout(armSettle, minVisible);

    const failsafe = setTimeout(hide, 20_000);
    return () => {
      obs.disconnect();
      clearTimeout(settleTimer);
      clearTimeout(quiet);
      clearTimeout(failsafe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // trava de seguranca: nunca fica presa se a navegacao abortar
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(hide, 25_000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (!loading) return null;
  return (
    <>
      <style>{`
        .nav-progress-bar{animation:nav-progress 1.1s ease-in-out infinite}
        @keyframes nav-progress{0%{transform:translateX(-110%)}100%{transform:translateX(330%)}}
      `}</style>
      {/* top-8: a faixa de anuncio verde (~30px) fica no topo — a barra
          em top-0 ficava esmeralda-sobre-esmeralda e sumia. */}
      <div className="pointer-events-none fixed inset-x-0 top-8 z-[60] h-1 bg-emerald-500/15">
        <div className="nav-progress-bar h-full w-1/3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.55)]" />
      </div>
    </>
  );
}

export default function NavProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}
