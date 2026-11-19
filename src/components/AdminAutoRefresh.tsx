"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-renderiza a pagina admin periodicamente para manter metricas
// e status de sync sempre atualizados sem F5 manual.
export default function AdminAutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
