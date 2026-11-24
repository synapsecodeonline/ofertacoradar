"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Overlay de carregamento: aparece em QUALQUER navegacao interna
// (clique, form GET, voltar/avancar, router.push) e so some quando a
// pagina nova ASSENTOU de verdade:
//   - DOM sem mutacoes ha ~1s (streaming SSR encerrado — cada chunk
//     do RSC gera mutacao, entao silencio = stream terminou)
//   - todas as imagens do conteudo completas (lazy abaixo da dobra
//     nao conta — so carrega ao rolar)
//   - fontes web carregadas
// E tudo isso sustentado por ~1.5s seguidos — um "vale" entre chunks
// nao engana. Nao da pra medir o fetch do RSC de forma confiavel
// (o router nao passa por window.fetch de jeito observavel), entao
// a fonte da verdade e o DOM: enquanto o stream entrega, o DOM muda.
// Failsafe de 20s + watchdog de 25s: nunca fica preso.
function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const pendingNav = useRef(false); // navegacao em andamento
  const navTarget = useRef<string | null>(null); // "path?search" de destino
  const startedAt = useRef(0);
  const pendingNet = useRef(0); // fetch/XHR same-origin com body pendente

  const hide = () => {
    pendingNav.current = false;
    navTarget.current = null;
    setLoading(false);
  };

  const begin = (target?: string) => {
    startedAt.current = Date.now();
    pendingNav.current = true;
    navTarget.current = target ?? null;
    setLoading(true);
  };

  // Contador de rede same-origin COMPLETA: fetch() resolve nos
  // headers, mas cliente pode ler o body por segundos (JSON grande,
  // stream). Drenamos um clone do body — so libera quando o ultimo
  // byte chega. XHR idem (loadend). Cross-origin (Chatwoot, GA, CDNs)
  // nao segura a barra.
  useEffect(() => {
    const isSame = (u: string) =>
      !u || u.startsWith("/") || u.startsWith(window.location.origin);

    const origFetch = window.fetch;
    window.fetch = (...args: Parameters<typeof fetch>) => {
      const input = args[0];
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (!isSame(url)) return origFetch(...args);
      pendingNet.current++;
      const release = () => pendingNet.current--;
      return origFetch(...args).then(
        (res) => {
          try {
            const body = res.clone().body;
            if (!body) {
              release();
              return res;
            }
            const reader = body.getReader();
            (async () => {
              try {
                while (!(await reader.read()).done) {
                  /* drena ate o fim do stream */
                }
              } catch {
                /* abortado */
              } finally {
                try {
                  reader.releaseLock();
                } catch {
                  /* noop */
                }
                release();
              }
            })();
          } catch {
            release();
          }
          return res;
        },
        (err) => {
          release();
          throw err;
        },
      );
    };

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    const pendingXhr = new WeakSet<XMLHttpRequest>();
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      (this as any).__navUrl = String(url);
      return (origOpen as any).apply(this, [method, url, ...rest]);
    };
    XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, ...a: unknown[]) {
      const u = String((this as any).__navUrl || "");
      if (isSame(u)) {
        pendingXhr.add(this);
        pendingNet.current++;
        const done = () => {
          if (pendingXhr.delete(this)) pendingNet.current--;
        };
        this.addEventListener("loadend", done, { once: true });
        this.addEventListener("error", done, { once: true });
        this.addEventListener("abort", done, { once: true });
      }
      return (origSend as any).apply(this, a);
    };

    return () => {
      window.fetch = origFetch;
      XMLHttpRequest.prototype.open = origOpen;
      XMLHttpRequest.prototype.send = origSend;
    };
  }, []);

  useEffect(() => {
    // Carregamento inicial (F5 / primeira visita / reload): trata como
    // uma navegacao cujo alvo ja e a URL atual — o efeito de commit
    // abaixo consome e so esconde quando a pagina assentar de verdade
    // (DOM quieto + rede zerada + imagens/fontes prontas).
    begin(window.location.pathname + window.location.search);

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
      begin(url.pathname + url.search);
    };
    document.addEventListener("click", maybeStart);
    document.addEventListener("submit", maybeStart);
    // voltar/avancar do navegador nao passa por click — a URL ja
    // mudou quando popstate dispara, entao o alvo e a location atual
    const onPop = () =>
      begin(window.location.pathname + window.location.search);
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
            begin(u.pathname + u.search);
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
  // estabilizar de forma SUSTENTADA. Poll a cada 300ms ate 20s.
  useEffect(() => {
    if (!pendingNav.current) return;
    // So consome quando a URL real bate com o alvo — renders
    // intermediarias podem disparar este efeito antes do commit e
    // roubar o pendingNav.
    const cur = window.location.pathname + window.location.search;
    if (navTarget.current !== null && navTarget.current !== cur) return;
    pendingNav.current = false;
    navTarget.current = null;

    let lastMut = Date.now();
    const obs = new MutationObserver(() => {
      lastMut = Date.now();
    });
    // documentElement em vez de body: durante a navegacao o router
    // pode trocar o body e observe(null) derrubava o efeito inteiro
    // (era o bug do overlay preso — o interval nunca chegava a nascer).
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const minVisible = Math.max(0, 900 - (Date.now() - startedAt.current));
    const t0 = Date.now();
    let readySince = 0;

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
      const domQuiet = Date.now() - lastMut > 1000;
      const allReady = domQuiet && pendingNet.current === 0 && contentReady();
      if (!allReady) {
        readySince = 0; // estragou — recomeca a contagem de prontidao
        return;
      }
      // So esconde depois de ~1.5s de prontidao SUSTENTADA: o stream
      // SSR entrega chunks em rajadas — um vale isolado de "tudo
      // pronto" entre dois chunks nao e suficiente.
      if (!readySince) readySince = Date.now();
      if (Date.now() - readySince > 1500) {
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
    const t = setTimeout(() => {
      hide();
    }, 25_000);
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
