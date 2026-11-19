import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTrackedUrl } from "@/lib/shortener";

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

  prisma.click
    .create({
      data: {
        productId: product.id,
        referer: request.headers.get("referer"),
        userAgent: request.headers.get("user-agent")?.slice(0, 500),
      },
    })
    .catch(() => {});

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

  // Produtos do catalogo nao tem link de afiliado pronto:
  // gera um lmdee.link rastreado na hora (cacheado) ou cai na URL direta.
  // Excecao: produtos flagados pelo validador com affiliateUrl == url
  // (lojas que dao 404 com ?lmdeeTracking=) caem no link direto abaixo.
  if (!product.affiliateUrl && product.organizationId) {
    const tracked = await getTrackedUrl(product.url, product.organizationId);
    return NextResponse.redirect(tracked ?? product.url, 302);
  }

  const target = new URL(product.affiliateUrl ?? product.url);
  const source = request.nextUrl.searchParams.get("src");
  if (source) target.searchParams.set("utm_source", source);

  return NextResponse.redirect(target, 302);
}
