import { after } from "next/server";
import { isAdmin } from "@/lib/admin";
import { startAllSyncs } from "@/lib/syncer";

export const dynamic = "force-dynamic";

// POST /api/admin/sync — forca um ciclo de sync de TODAS as fontes (admin).
// Adquire a trava na hora e devolve o status por fonte; o trabalho roda
// em after() e o card de sync no /admin mostra a fase ao vivo.
export async function POST() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Login necessário" }, { status: 401 });
  }

  let sync;
  try {
    sync = await startAllSyncs();
  } catch (e) {
    return Response.json(
      { error: `Falha ao iniciar sync: ${String(e).slice(0, 200)}` },
      { status: 500 },
    );
  }

  after(() => sync.run().catch(() => {}));

  return Response.json({ ok: true, sources: sync.results });
}

export async function GET() {
  return Response.json({ error: "Use POST" }, { status: 405 });
}
