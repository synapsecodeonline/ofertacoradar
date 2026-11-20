import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { discountPercent, formatPrice } from "@/lib/format";
import { siteUrl, SITE_NAME } from "@/lib/site";
import { featuredStoreFor } from "@/lib/store-logo";
import { storeLogo } from "@/lib/featured-stores";

export const dynamic = "force-dynamic";

// Fonte com acentuacao pt-BR (Inter via Google Fonts)
let fontPromise: Promise<
  { name: string; data: ArrayBuffer; weight: 800; style: "normal" }[]
> | null = null;

function getFont() {
  fontPromise ??= (async () => {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Inter:wght@700;800;900&display=swap",
      { headers: { "User-Agent": "Mozilla/5.0" } },
    ).then((r) => r.text());
    const url = css.match(/src: url\((https:[^)]+\.ttf)\)/)?.[1];
    if (!url) throw new Error("fonte nao encontrada");
    const data = await fetch(url).then((r) => r.arrayBuffer());
    return [{ name: "Inter", data, weight: 800, style: "normal" as const }];
  })();
  return fontPromise;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Cards para redes sociais: apenas usuários autenticados
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return new Response("Login necessário", { status: 401 });
    }
  } catch {
    return new Response("Login necessário", { status: 401 });
  }

  const { id } = await params;
  const size = new URL(req.url).searchParams.get("size") === "story"
    ? "story"
    : "feed";
  const W = 1080;
  const H = size === "story" ? 1920 : 1080;

  const product = await prisma.product.findUnique({
    where: { id: Number(id) },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      price: true,
      oldPrice: true,
      discountPct: true,
      currency: true,
      merchant: true,
      couponCode: true,
      externalId: true,
    },
  });
  if (!product) return new Response("Produto nao encontrado", { status: 404 });

  const isAmazon =
    product.externalId?.startsWith("amz:") ||
    product.merchant?.toLowerCase() === "amazon";

  const discount =
    product.discountPct ?? discountPercent(product.price, product.oldPrice);
  const domain = new URL(siteUrl()).host;

  // Logo da loja (Brand.logo ou favicon do dominio)
  const brandRows = await prisma.brand.findMany({
    select: { name: true, logo: true },
  });
  const storeLogoUrl = product.merchant
    ? storeLogo(
        featuredStoreFor(product.merchant),
        new Map(brandRows.map((b) => [b.name ?? "", b.logo])),
      )
    : null;

  const fonts = await getFont().catch(() => []);

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(160deg, #022c22 0%, #042f2e 55%, #134e4a 100%)",
          fontFamily: "Inter",
          color: "white",
          padding: size === "story" ? 72 : 64,
        }}
      >
        {/* Topo: badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {discount !== null && (
            <div
              style={{
                background: "linear-gradient(135deg, #dc2626, #ef4444)",
                borderRadius: 18,
                padding: "14px 28px",
                fontSize: 52,
                fontWeight: 900,
              }}
            >
              {`-${discount}%`}
            </div>
          )}
          {product.merchant && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                background: "rgba(255,255,255,0.08)",
                borderRadius: 18,
                padding: "12px 24px",
              }}
            >
              {isAmazon ? (
                // seta-sorriso oficial da logo Amazon (path real do wordmark,
                // viewBox recortada na regiao do simbolo) — SVG externo
                // e instavel no next/og
                <svg width="120" height="30" viewBox="75 90 380 100">
                  <path
                    d="m 374.00642,142.18404 c -34.99948,25.79739 -85.72909,39.56123 -129.40634,39.56123 -61.24255,0 -116.37656,-22.65135 -158.08757,-60.32496 -3.2771,-2.96252 -0.34083,-6.9999 3.59171,-4.69283 45.01431,26.19064 100.67269,41.94697 158.16623,41.94697 38.774689,0 81.4295,-8.02237 120.6499,-24.67006 5.92501,-2.51683 10.87999,3.88009 5.08607,8.17965"
                    fill="#ff9900"
                  />
                  <path
                    d="m 388.55678,125.53635 c -4.45688,-5.71527 -29.57261,-2.70033 -40.84585,-1.36327 -3.43442,0.41947 -3.95874,-2.56925 -0.86517,-4.71905 20.00346,-14.07844 52.82696,-10.01483 56.65462,-5.2958 3.82764,4.74526 -0.99624,37.64741 -19.79373,53.35128 -2.88385,2.41195 -5.63662,1.12734 -4.35198,-2.07113 4.2209,-10.53917 13.68519,-34.16054 9.20211,-39.90203"
                    fill="#ff9900"
                  />
                </svg>
              ) : storeLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={storeLogoUrl}
                  alt=""
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    objectFit: "contain",
                    background: "white",
                    padding: 6,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: "#134e4a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 30,
                    fontWeight: 900,
                    color: "#5eead4",
                  }}
                >
                  {product.merchant.charAt(0).toUpperCase()}
                </div>
              )}
              <div
                style={{
                  fontSize: 34,
                  fontWeight: isAmazon ? 900 : 800,
                  color: isAmazon ? "#ffffff" : "#99f6e4",
                  letterSpacing: isAmazon ? 2 : 1,
                  textTransform: "uppercase",
                }}
              >
                {product.merchant}
              </div>
            </div>
          )}
        </div>

        {/* Produto */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "white",
            borderRadius: 36,
            marginTop: 36,
            padding: 40,
            boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
          }}
        >
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.title}
              style={{
                maxWidth: "100%",
                maxHeight: size === "story" ? 900 : 560,
                objectFit: "contain",
              }}
            />
          ) : (
            <div style={{ fontSize: 40, color: "#a1a1aa" }}>{product.title}</div>
          )}
        </div>

        {/* Info */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            marginTop: 36,
          }}
        >
          <div
            style={{
              fontSize: size === "story" ? 40 : 36,
              fontWeight: 800,
              lineHeight: 1.25,
              maxHeight: size === "story" ? 100 : 90,
              overflow: "hidden",
            }}
          >
            {product.title}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            {product.price != null && (
              <div
                style={{
                  fontSize: size === "story" ? 96 : 84,
                  fontWeight: 900,
                  color: "#34d399",
                }}
              >
                {formatPrice(product.price, product.currency)}
              </div>
            )}
            {product.oldPrice != null &&
              product.oldPrice > (product.price ?? 0) && (
                <div
                  style={{
                    fontSize: size === "story" ? 44 : 40,
                    color: "#a7f3d0",
                    textDecoration: "line-through",
                  }}
                >
                  {formatPrice(product.oldPrice, product.currency)}
                </div>
              )}
          </div>
          {product.couponCode && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: "rgba(251,191,36,0.15)",
                border: "2px dashed #fbbf24",
                borderRadius: 20,
                padding: "16px 28px",
                alignSelf: "flex-start",
              }}
            >
              <div style={{ fontSize: 28, color: "#fbbf24", fontWeight: 800 }}>
                Cupom:
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  color: "#fde68a",
                  fontFamily: "monospace",
                  letterSpacing: 2,
                }}
              >
                {product.couponCode}
              </div>
            </div>
          )}
        </div>

        {/* Rodape */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 36,
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 800, color: "#5eead4" }}>
            {SITE_NAME}
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#99f6e4" }}>
            {`${domain}/produto/${product.id}`}
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: fonts.length ? fonts : undefined,
    },
  );

  const headers = new Headers(image.headers);
  headers.set(
    "Content-Disposition",
    `attachment; filename="oferta-${product.id}-${size}.png"`,
  );
  return new Response(image.body, { status: 200, headers });
}
