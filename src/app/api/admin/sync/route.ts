import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { maybeSyncLomadee, maybeSyncML } from "@/lib/syncer";

export const dynamic = "force-dynamic";

// POST /api/admin/sync — forca um ciclo de sync das fontes (admin only).
// after() mantem a function viva depois da resposta.
export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return Response.json({ error: "Login necessário" }, { status: 401 });
  }

  after(() => {
    maybeSyncLomadee(true).catch(() => {});
    maybeSyncML(true).catch(() => {});
  });

  return Response.json({ ok: true, started: true });
}

export async function GET() {
  return Response.json({ error: "Use POST" }, { status: 405 });
}
