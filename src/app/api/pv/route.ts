import { prisma } from "@/lib/db";
import { hasAdminSession } from "@/lib/adminSession";
import { isBot } from "@/lib/bots";
import { createClient } from "@/lib/supabase/server";

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

// POST /api/pv { path: "/?aba=ml" }
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

    // bots/crawlers nao sao visitas reais
    if (isBot(req.headers.get("user-agent"))) {
      return Response.json({ ok: true });
    }

    // nao contabiliza pageview do proprio admin logado.
    // 1) atalho: cookie de sessao presente -> pula sem chamar a API
    // 2) sem cookie detectavel, valida a sessao de verdade via Supabase
    //    (o nome/chunk do cookie pode variar — getUser e autoritativo)
    if (hasAdminSession(req.headers.get("cookie"))) {
      return Response.json({ ok: true });
    }
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) return Response.json({ ok: true });
    } catch {
      // falha na auth nao deve impedir a contagem do pageview
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
