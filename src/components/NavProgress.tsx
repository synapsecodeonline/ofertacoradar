"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Barra de progresso indeterminada: aparece em QUALQUER navegacao
// interna — clique em link, submit de form GET, botao voltar/avancar —
// e so some quando a pagina nova CARREGOU TUDO: shell commitado +
// streaming SSR encerrado + fetches same-origin zerados + imagens do
// conteudo completas. Failsafe de 20s.
function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const pendingNav = useRef(false); // navegacao em andamento
  const startedAt = useRef(0);
  const pendingFetch = useRef(0); // fetch() same-origin em voo

  const hide = () => {
    pendingNav.current = false;
    setLoading(false);
  };

  const begin = () => {
    startedAt.current = Date.now();
    pendingNav.current = true;
    setLoading(true);
  };

  // Contador de fetches same-origin: o router do Next usa fetch() para
  // o payload RSC — enquanto houver request em voo a pagina nao
  // terminou. Chamadas a outras origens (Chatwoot, analytics, CDNs)
  // nao seguram a barra.
  useEffect(() => {
    const orig = window.fetch;
    window.fetch = (...args: Parameters<typeof fetch>) => {
      const input = args[0];
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const sameOrigin =
        !url ||
        url.startsWith("/") ||
        url.startsWith(window.location.origin);
      if (sameOrigin) pendingFetch.current++;
      return orig(...args).finally(() => {
        if (sameOrigin) pendingFetch.current--;
      });
    };
    return () => {
      window.fetch = orig;
    };
  }, []);

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
      begin();
    };
    document.addEventListener("click", maybeStart);
    document.addEventListener("submit", maybeStart);
    // voltar/avancar do navegador nao passa por click — cobre aqui
    const onPop = () => begin();
    window.addEventListener("popstate", onPop);

    // router.push()/replaceState() programatico (botoes, auth, etc)
    // passa por history — cobre TODA navegacao client-side. Pula
    // mudanca so de hash/mesma URL (nao ha fetch de servidor).
    const wrap = (fn: History["pushState"]) =>
      function (this: History, ...a: Parameters<History["pushState"]>) {
        try {
          const u = new URL(String(a[2] ?? ""), window.location.href);
          if (
            u.pathname !== window.location.pathname ||
            u.search !== window.location.search
          ) {
            begin();
          }
        } catch {
          begin();
        }
        return fn.apply(this, a);
      };
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = wrap(origPush) as History["pushState"];
    history.replaceState = wrap(origReplace) as History["replaceState"];

    return () => {
      document.removeEventListener("click", maybeStart);
      document.removeEventListener("submit", maybeStart);
      window.removeEventListener("popstate", onPop);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Commit da navegacao: a partir daqui so esconde quando TUDO
  // estabilizar — mutacoes do DOM paradas (streaming encerrado),
  // nenhum fetch same-origin em voo (payload RSC completo) e imagens
  // do miolo carregadas. Poll a cada 300ms ate 20s de failsafe.
  useEffect(() => {
    if (!pendingNav.current) return;
    pendingNav.current = false;

    let lastMut = Date.now();
    const obs = new MutationObserver(() => {
      lastMut = Date.now();
    });
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const minVisible = Math.max(0, 900 - (Date.now() - startedAt.current));
    const t0 = Date.now();

    const imgsReady = () => {
      // So conta imagem que deveria estar carregando AGORA: completa,
      // ou lazy abaixo da dobra (ainda nao comecou — nao e "carregando").
      // Sem isso a barra ficaria presa esperando imagem de produto
      // que so carrega quando o usuario rola a pagina.
      const vh = window.innerHeight;
      const imgs = document.querySelectorAll("main img, article img");
      for (const im of imgs) {
        const el = im as HTMLImageElement;
        if (el.complete) continue;
        const rect = el.getBoundingClientRect();
        const belowFold = el.loading === "lazy" && rect.top > vh + 200;
        if (!belowFold) return false;
      }
      return true;
    };

    const iv = setInterval(() => {
      const elapsed = Date.now() - t0;
      if (elapsed > 20_000) {
        clearInterval(iv);
        obs.disconnect();
        hide();
        return;
      }
      if (elapsed < minVisible) return;
      const domQuiet = Date.now() - lastMut > 600;
      if (domQuiet && pendingFetch.current === 0 && imgsReady()) {
        clearInterval(iv);
        obs.disconnect();
        hide();
      }
    }, 300);

    return () => {
      clearInterval(iv);
      obs.disconnect();
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
        .nav-progress-glow{animation:nav-progress-glow 1.1s ease-in-out infinite}
        @keyframes nav-progress{0%{transform:translateX(-120%)}100%{transform:translateX(340%)}}
        @keyframes nav-progress-glow{0%,100%{opacity:.5}50%{opacity:1}}
      `}</style>
      {/* Colada na borda inferior do <header> sticky (absolute dentro
          dele) — visivel no topo E scrollado, em todas as telas. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[3px] bg-emerald-500/10">
        <div className="nav-progress-bar absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
        <div className="nav-progress-glow absolute inset-y-0 w-full bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
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
