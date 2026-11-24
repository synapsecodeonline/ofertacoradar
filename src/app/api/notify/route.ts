import { prisma } from "@/lib/db";
import { isBot } from "@/lib/bots";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// POST /api/notify { email, productId? }
// Captura email para "avise-me quando baixar" / alertas de preco.
export async function POST(req: Request) {
  try {
    if (!rateLimit(`notify:${clientIp(req)}`, 10)) {
      return Response.json({ ok: true });
    }
    if (isBot(req.headers.get("user-agent"))) {
      return Response.json({ ok: true });
    }
    const body = (await req.json().catch(() => null)) as {
      email?: string;
      productId?: number;
    } | null;
    const email = body?.email?.trim().toLowerCase().slice(0, 200) ?? "";
    if (!EMAIL_RE.test(email)) {
      return Response.json(
        { ok: false, error: "E-mail inválido" },
        { status: 400 },
      );
    }
    const productId =
      typeof body?.productId === "number" && body.productId > 0
        ? body.productId
        : null;

    try {
      await prisma.subscriber.upsert({
        where: { email },
        create: { email, productId },
        update: { productId },
      });
      return Response.json({ ok: true });
    } catch {
      // Tabela Subscriber ainda nao migrada — nao quebra a UX
      return Response.json(
        { ok: false, error: "Indisponível no momento" },
        { status: 503 },
      );
    }
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
