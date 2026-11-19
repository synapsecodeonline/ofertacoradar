import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Health check do banco: usado pelo DbStatusBanner (so exibe para
// usuarios logados). Timeout de 5s para nao pendurar a funcao.
export async function GET() {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5_000)),
    ]);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
