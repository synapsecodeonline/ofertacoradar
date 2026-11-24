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
    let readySince = 0; // primeira vez que TUDO ficou pronto

    const contentReady = () => {
      // TODAS as imagens do conteudo tem que estar prontas — nao so as
      // de <main>/<article> (variava por pagina e a barra sumia com
      // imagem ainda carregando). Excecoes:
      //  - header/nav/footer (logo, icones — nao sao "conteudo")
      //  - lazy abaixo da dobra: so comeca a carregar quando o usuario
      //    rola — esperar por ela travaria a barra em toda listagem.
      const vh = window.innerHeight;
      const imgs = document.querySelectorAll("img");
      for (const im of imgs) {
        const el = im as HTMLImageElement;
        if (el.closest("header, nav, footer")) continue;
        if (el.complete) continue;
        const rect = el.getBoundingClientRect();
        const belowFold = el.loading === "lazy" && rect.top > vh + 200;
        if (!belowFold) return false;
      }
      // fontes web (proxima-nova etc) tambem fazem a pagina "piscar"
      // depois que a barra some
      return document.fonts.status === "loaded";
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
      const domQuiet = Date.now() - lastMut > 800;
      const allReady =
        domQuiet && pendingFetch.current === 0 && contentReady();
      if (!allReady) {
        readySince = 0; // estragou — recomeca a contagem de prontidao
        return;
      }
      // So esconde depois de ~1s de prontidao SUSTENTADA: streaming
      // SSR tem gaps >600ms entre chunks e imagens/fontes chegam
      // atrasadas — um vale isolado de "tudo pronto" nao e suficiente.
      if (!readySince) readySince = Date.now();
      if (Date.now() - readySince > 1000) {
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
    <div
      role="status"
      aria-label="Carregando página"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-950/55 backdrop-blur-[3px] animate-[nav-fade-in_.18s_ease-out]"
    >
      <style>{`
        @keyframes nav-fade-in{from{opacity:0}to{opacity:1}}
        @keyframes nav-spin{to{transform:rotate(360deg)}}
      `}</style>
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-12 w-12 rounded-full border-[3px] border-emerald-400/25 border-t-emerald-400"
          style={{ animation: "nav-spin .8s linear infinite" }}
        />
        <p className="text-sm font-semibold text-white/90">
          Carregando ofertas…
        </p>
      </div>
    </div>
  );
}

export default function NavProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}
