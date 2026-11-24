import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/admin/scrape — admin pede um scrape local (ml|amz).
// O site roda em container sem Docker/sessao — grava um pedido em
// ScriptState ("scrape-request:{src}") e o dispatcher local
// (scripts/scrape-dispatch.sh, cron 1min) executa no host.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return Response.json({ error: "Login necessário" }, { status: 401 });
  }

  let src = "";
  try {
    src = String((await req.json()).src ?? "");
  } catch {
    /* body vazio */
  }
  if (src !== "ml" && src !== "amz") {
    return Response.json({ error: "src deve ser ml ou amz" }, { status: 400 });
  }

  const key = `scrape-request:${src}`;
  const existing = await prisma.scriptState.findUnique({ where: { key } });
  const st = existing?.value as { status?: string; at?: string } | undefined;
  // ja na fila ou rodando — nao duplica pedido
  if (st?.status === "queued" || st?.status === "running") {
    return Response.json({ ok: true, already: true });
  }

  await prisma.scriptState.upsert({
    where: { key },
    create: { key, value: { at: new Date().toISOString(), status: "queued" } },
    update: { value: { at: new Date().toISOString(), status: "queued" } },
  });

  return Response.json({ ok: true });
}
