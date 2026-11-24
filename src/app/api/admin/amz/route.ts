import { isAdmin } from "@/lib/admin";
import {
  addAmazonProduct,
  lookupAmazonProduct,
  parseAsin,
} from "@/lib/amazon";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  return isAdmin();
}

// POST /api/admin/amz { action: "lookup" | "add", ... }
// Cadastro manual de produtos Amazon (antes da API ser liberada).
export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return Response.json({ error: "Login necessário" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    action?: string;
    input?: string;
    asin?: string;
    title?: string;
    price?: number | null;
    oldPrice?: number | null;
    imageUrl?: string | null;
    description?: string | null;
  } | null;
  if (!body) return Response.json({ error: "Body inválido" }, { status: 400 });

  if (body.action === "lookup") {
    const asin = body.input ? parseAsin(body.input) : null;
    if (!asin) {
      return Response.json(
        { error: "Link ou ASIN da Amazon inválido" },
        { status: 400 },
      );
    }
    const data = await lookupAmazonProduct(asin);
    return Response.json(data);
  }

  if (body.action === "add") {
    const asin = body.asin ? parseAsin(body.asin) : null;
    const title = body.title?.trim();
    if (!asin || !title) {
      return Response.json(
        { error: "ASIN e título são obrigatórios" },
        { status: 400 },
      );
    }
    if (!body.imageUrl?.trim()) {
      return Response.json(
        { error: "Imagem é obrigatória — produto sem imagem não aparece no site" },
        { status: 400 },
      );
    }
    const product = await addAmazonProduct({
      asin,
      title,
      price: body.price ?? null,
      oldPrice: body.oldPrice ?? null,
      imageUrl: body.imageUrl.trim(),
      description: body.description?.trim() || null,
    });
    return Response.json({ ok: true, id: product.id });
  }

  return Response.json({ error: "action inválida" }, { status: 400 });
}
