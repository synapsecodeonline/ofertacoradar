"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Conta pageviews: dispara 1x por mudanca de rota para /api/pv.
 * Nao bloqueia nada — fire and forget.
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const last = useRef("");

  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    // ignora rotas de API/assets (nao devem renderizar o layout anyway)
    if (pathname.startsWith("/api/")) return;
    last.current = pathname;
    const path = pathname + window.location.search;
    fetch("/api/pv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path.slice(0, 300) }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
