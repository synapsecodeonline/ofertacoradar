import { createClient } from "@/lib/supabase/server";
import { getInstagramKit } from "@/lib/instagramKit";

export const dynamic = "force-dynamic";

// Kit diario de conteudo para o Instagram: ofertas sem expiracao,
// ranqueadas por cliques 24h + desconto. Requer login (mesmo /api/card).
// GET /api/instagram/kit?count=10
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return Response.json({ error: "Login necessário" }, { status: 401 });
    }
  } catch {
    return Response.json({ error: "Login necessário" }, { status: 401 });
  }

  const url = new URL(req.url);
  const count = Math.min(20, Math.max(1, Number(url.searchParams.get("count")) || 10));
  const kit = await getInstagramKit(count);
  return Response.json({
    generatedAt: kit.generatedAt,
    siteUrl: kit.siteUrl,
    count: kit.items.length,
    items: kit.items.map(({ cardStoryUrl: _s, ...rest }) => ({
      ...rest,
      size: "feed",
      cardUrl: rest.cardUrl,
    })),
  });
}
