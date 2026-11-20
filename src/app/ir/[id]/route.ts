import { NextRequest, NextResponse, after } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { prisma } from "@/lib/db";
import { getTrackedUrl } from "@/lib/shortener";
import { isBot } from "@/lib/bots";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/ir/[id]">,
) {
  const { id } = await ctx.params;
  const product = await prisma.product.findUnique({
    where: { id: Number(id), active: true },
  });

  if (!product) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  // registra o clique em background, pulando admin logado e bots.
  // Sessao validada via Supabase (autoritativo) — nao atrasa o redirect.
  after(async () => {
    const userAgent = request.headers.get("user-agent");
    if (isBot(userAgent)) return;
    try {
      // client montado com os cookies da request — funciona dentro de
      // after(), onde next/headers nao tem escopo
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: () => {},
          },
        },
      );
      const { data } = await supabase.auth.getUser();
      if (data.user) return;
    } catch {
      // falha na auth nao impede o registro do clique
    }
    await prisma.click
      .create({
        data: {
          productId: product.id,
          referer: request.headers.get("referer"),
          userAgent: userAgent?.slice(0, 500),
        },
      })
      .catch(() => {});
  });

  // Mercado Livre: programa de afiliados proprio (independente da Lomadee).
  // Com ML_AFFILIATE_TOOL/WORD configurados, manda para a pagina de catalogo
  // /p/MLB{id} com matt_tool/matt_word — a commissionacao fica no ML.
  if (product.externalId?.startsWith("ml:")) {
    const tool = process.env.ML_AFFILIATE_TOOL;
    const catalogId = product.externalId.slice(3);
    if (tool && catalogId) {
      const target = new URL(
        `https://www.mercadolivre.com.br/p/${catalogId}`,
      );
      target.searchParams.set("matt_tool", tool);
      const word = process.env.ML_AFFILIATE_WORD;
      if (word) target.searchParams.set("matt_word", word);
      const source = request.nextUrl.searchParams.get("src");
      if (source) target.searchParams.set("utm_source", source);
      return NextResponse.redirect(target, 302);
    }
  }

  // Amazon: garante o Partner Tag no redirect — a comissao so conta
  // com ?tag= valido. affiliateUrl ja vem com tag do sync; aqui e
  // reforco caso o produto tenha sido criado sem ela.
  if (product.externalId?.startsWith("amz:")) {
    const target = new URL(product.affiliateUrl ?? product.url);
    target.searchParams.set("tag", process.env.AMZ_TAG ?? "synapsecodeon-20");
    const source = request.nextUrl.searchParams.get("src");
    if (source) target.searchParams.set("utm_source", source);
    return NextResponse.redirect(target, 302);
  }

  // Produtos do catalogo nao tem link de afiliado pronto:
  // gera um lmdee.link rastreado na hora (cacheado) ou cai na URL direta.
  // Todo produto ativo foi validado com lmdeeTracking — se a loja quebra
  // com o parametro, o validador ja desativou o produto.
  if (!product.affiliateUrl && product.organizationId) {
    const tracked = await getTrackedUrl(product.url, product.organizationId);
    return NextResponse.redirect(tracked ?? product.url, 302);
  }

  const target = new URL(product.affiliateUrl ?? product.url);
  const source = request.nextUrl.searchParams.get("src");
  if (source) target.searchParams.set("utm_source", source);

  return NextResponse.redirect(target, 302);
}
