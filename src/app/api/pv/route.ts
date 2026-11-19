import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const PV_EXTERNAL_ID = "internal:pageview";

// Produto sentinela que ancora os pageviews na tabela Click
// (nao da pra criar tabela nova: role do banco nao tem DDL).
async function pvProductId(): Promise<number> {
  const found = await prisma.product.findUnique({
    where: { externalId: PV_EXTERNAL_ID },
    select: { id: true },
  });
  if (found) return found.id;
  const created = await prisma.product.create({
    data: {
      externalId: PV_EXTERNAL_ID,
      title: "Pageview interno",
      url: "/",
      active: true,
    },
    select: { id: true },
  });
  return created.id;
}

// POST /api/pv { path: "/ofertas-do-dia?aba=ml" }
// Registra um pageview como Click no produto sentinela.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      path?: string;
    } | null;
    const path = typeof body?.path === "string" ? body.path : "";
    if (!path.startsWith("/") || path.length > 300) {
      return Response.json({ ok: false }, { status: 400 });
    }
    // pula assets internos e o proprio endpoint
    if (path.startsWith("/api/") || /\.(png|jpe?g|webp|svg|ico|css|js)$/i.test(path)) {
      return Response.json({ ok: true });
    }

    const productId = await pvProductId();
    await prisma.click.create({
      data: {
        productId,
        referer: path,
        userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
