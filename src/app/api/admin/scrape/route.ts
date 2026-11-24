import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/admin/scrape — admin pede um scrape local (ml|amz).
// O site roda em container sem Docker/sessao — grava um pedido em
// ScriptState ("scrape-request:{src}") e o dispatcher local
// (scripts/scrape-dispatch.sh, cron 1min) executa no host.
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "Login necessário" }, { status: 401 });
  }

  let src = "";
  let action = "";
  let queries: string[] = [];
  let maxNew: number | null = null;
  try {
    const body = await req.json();
    src = String(body.src ?? "");
    action = String(body.action ?? "");
    if (Array.isArray(body.queries)) {
      queries = body.queries
        .map((q: unknown) => String(q).trim())
        .filter((q: string) => q.length > 0 && q.length <= 80)
        .slice(0, 20);
    }
    const n = Number(body.maxNew);
    if (Number.isFinite(n) && n >= 1 && n <= 500) maxNew = Math.floor(n);
  } catch {
    /* body vazio */
  }
  if (src !== "ml" && src !== "amz") {
    return Response.json({ error: "src deve ser ml ou amz" }, { status: 400 });
  }

  // POST {src, action:"cancel"} — botao "Parar" do admin:
  //  - pedido "queued": apaga a linha — o dispatcher nunca pega
  //  - pedido "running": apaga a linha E grava scrape-cancel:{src};
  //    o dispatcher ve a flag em ate ~4s, mata o processo (e o
  //    container docker do projeto) e reporta o cancelamento
  // Nos dois casos grava scrape:{src} na hora para a tela mostrar
  // "cancelado" sem esperar o dispatcher (que sobrescreve com o
  // reporte final + log quando concluir a parada).
  if (action === "cancel") {
    const key = `scrape-request:${src}`;
    const existing = await prisma.scriptState.findUnique({ where: { key } });
    if (!existing) {
      return Response.json({ ok: true, nothing: true });
    }
    const st = existing.value as { status?: string } | undefined;
    await prisma.scriptState.delete({ where: { key } }).catch(() => {});
    const at = new Date().toISOString();
    if (st?.status === "running") {
      await prisma.scriptState.upsert({
        where: { key: `scrape-cancel:${src}` },
        create: { key: `scrape-cancel:${src}`, value: { at } },
        update: { value: { at } },
      });
    }
    const rep = { at, ok: false, erro: "cancelado pelo usuário" };
    await prisma.scriptState.upsert({
      where: { key: `scrape:${src}` },
      create: { key: `scrape:${src}`, value: rep },
      update: { value: rep },
    });
    return Response.json({ ok: true, cancelled: true });
  }

  const key = `scrape-request:${src}`;
  const existing = await prisma.scriptState.findUnique({ where: { key } });
  const st = existing?.value as { status?: string; at?: string } | undefined;
  // ja na fila ou rodando — nao duplica pedido
  if (st?.status === "queued" || st?.status === "running") {
    return Response.json({ ok: true, already: true });
  }

  const value = {
    at: new Date().toISOString(),
    status: "queued",
    ...(queries.length ? { queries } : {}),
    ...(maxNew ? { maxNew } : {}),
  };
  await prisma.scriptState.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });

  return Response.json({ ok: true });
}

// GET /api/admin/scrape — estado dos pedidos e ultimo resultado,
// usado pelo botao para mostrar "rodando..." e o resultado final.
export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Login necessário" }, { status: 401 });
  }

  const [reqMl, reqAmz, lastMl, lastAmz] = await Promise.all([
    prisma.scriptState.findUnique({ where: { key: "scrape-request:ml" } }),
    prisma.scriptState.findUnique({ where: { key: "scrape-request:amz" } }),
    prisma.scriptState.findUnique({ where: { key: "scrape:ml" } }),
    prisma.scriptState.findUnique({ where: { key: "scrape:amz" } }),
  ]);

  return Response.json({
    requests: {
      ml: reqMl?.value ?? null,
      amz: reqAmz?.value ?? null,
    },
    last: {
      ml: lastMl?.value ?? null,
      amz: lastAmz?.value ?? null,
    },
  });
}
