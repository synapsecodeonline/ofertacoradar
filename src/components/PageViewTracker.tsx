"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { getSessionId } from "@/lib/session";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
] as const;

/**
 * Conta pageviews: dispara 1x por mudanca de rota para /api/pv.
 * Nao bloqueia nada — fire and forget.
 * Envia sid de sessao + UTMs da URL para atribuir a visita.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const last = useRef("");

  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    // ignora rotas de API/assets (nao devem renderizar o layout anyway)
    if (pathname.startsWith("/api/")) return;
    last.current = pathname;
    const sp = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = sp.get(k);
      if (v) utm[k] = v.slice(0, 80);
    }
    const path = pathname + window.location.search;
    fetch("/api/pv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: path.slice(0, 300),
        sid: getSessionId(),
        utm,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
