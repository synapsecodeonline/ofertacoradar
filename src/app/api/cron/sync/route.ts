import { after, type NextRequest } from "next/server";
import { maybeSyncLomadee, maybeSyncML } from "@/lib/syncer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/sync?key=CRON_SECRET
// Ping externo (cron-job.org, UptimeRobot etc.) a cada 1min para manter o
// sync das fontes rodando 24/7 mesmo sem visitas no site.
// Resposta imediata — o trabalho roda em after() com trava + heartbeat.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.nextUrl.searchParams.get("key") !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  after(() => {
    maybeSyncLomadee().catch(() => {});
    maybeSyncML().catch(() => {});
  });
  return Response.json({ ok: true });
}
