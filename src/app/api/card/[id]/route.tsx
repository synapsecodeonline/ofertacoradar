import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";
import { discountPercent, formatPrice } from "@/lib/format";
import { siteUrl, SITE_NAME } from "@/lib/site";

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
    },
  });
  if (!product) return new Response("Produto nao encontrado", { status: 404 });

  const discount =
    product.discountPct ?? discountPercent(product.price, product.oldPrice);
  const domain = new URL(siteUrl()).host;

  const fonts = await getFont().catch(() => []);

  return new ImageResponse(
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
                fontSize: 34,
                fontWeight: 800,
                color: "#99f6e4",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {product.merchant}
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
}
