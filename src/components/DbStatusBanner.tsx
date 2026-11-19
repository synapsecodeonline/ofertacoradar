"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Aviso de banco fora do ar — so aparece para usuario LOGADO.
// Verifica a cada 60s via /api/health.
export default function DbStatusBanner() {
  const [down, setDown] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const check = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          if (mounted) setDown(false);
          return;
        }
        const res = await fetch("/api/health", { cache: "no-store" });
        const json = (await res.json().catch(() => ({ ok: false }))) as {
          ok?: boolean;
        };
        if (mounted) setDown(!(res.ok && json.ok === true));
      } catch {
        if (mounted) setDown(true);
      }
    };

    check();
    const t = setInterval(check, 60_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  if (!down) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
      Banco de dados indisponível no momento — ofertas e páginas podem não
      carregar. O sistema continua tentando reconectar.
    </div>
  );
}
