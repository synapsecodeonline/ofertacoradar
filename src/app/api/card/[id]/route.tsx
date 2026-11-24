import { ImageResponse } from "next/og";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { discountPercent, formatPrice } from "@/lib/format";
import { siteUrl, SITE_NAME } from "@/lib/site";
import { featuredStoreFor } from "@/lib/store-logo";
import { storeLogo } from "@/lib/featured-stores";
import { AMZ_SMILE_PATHS, AMZ_SMILE_VIEWBOX } from "@/components/AmazonMark";

export const dynamic = "force-dynamic";

// Fonte com acentuacao pt-BR (Inter via Google Fonts)
let fontPromise: Promise<
  { name: string; data: ArrayBuffer; weight: 800; style: "normal" }[]
> | null = null;

// Cache em memoria url -> data URI (container longevo). Evita
// re-download a cada card e segura o renderer de depender de CDN
// que muda de comportamento.
const imgCache = new Map<string, { uri: string; exp: number }>();
const IMG_CACHE_TTL = 6 * 3600_000;
const IMG_CACHE_MAX = 400;

// Baixa a imagem com UA de browser (CDNs de loja bloqueiam fetch
// "pelado") e devolve data URI num formato que o next/og entende.
// WebP/AVIF/etc sao convertidos p/ PNG via sharp — o renderer do
// next/og NAO embute webp (foi a causa dos cards sem foto do ML).
async function imageToDataUri(url: string): Promise<string | null> {
  if (url.startsWith("data:image/")) return url;
  const hit = imgCache.get(url);
  if (hit && hit.exp > Date.now()) return hit.uri;

  let buf: Buffer | null = null;
  let ct = "";
  for (let attempt = 0; attempt < 2 && !buf; attempt++) {
    try {
      const r = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(12000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
          Referer: new URL(url).origin + "/",
        },
      });
      if (!r.ok) continue;
      const len = Number(r.headers.get("content-length") ?? 0);
      if (len > 15_000_000) continue;
      const ab = await r.arrayBuffer();
      if (ab.byteLength > 15_000_000 || ab.byteLength === 0) continue;
      ct = (r.headers.get("content-type") ?? "").split(";")[0].trim();
      buf = Buffer.from(ab);
    } catch {
      /* retry */
    }
  }
  if (!buf) return null;

  try {
    const okRaster = /^image\/(png|jpe?g|gif|bmp|webp|avif|tiff?|svg\+xml)$/.test(ct);
    if (!okRaster && !ct.startsWith("image/")) return null;
    let out: Buffer;
    let outCt: string;
    if (ct === "image/png" || ct === "image/jpeg" || ct === "image/jpg" || ct === "image/gif") {
      out = buf;
      outCt = ct === "image/jpg" ? "image/jpeg" : ct;
    } else {
      // webp/avif/svg/bmp/tiff -> png (unico formato que o satori
      // garante em qualquer versao)
      out = await sharp(buf, { failOn: "none" })
        .rotate()
        .png({ compressionLevel: 6 })
        .toBuffer();
      outCt = "image/png";
    }
    const uri = `data:${outCt};base64,${out.toString("base64")}`;
    if (imgCache.size >= IMG_CACHE_MAX) {
      const oldest = imgCache.keys().next().value;
      if (oldest) imgCache.delete(oldest);
    }
    imgCache.set(url, { uri, exp: Date.now() + IMG_CACHE_TTL });
    return uri;
  } catch {
    return null;
  }
}

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
  // Cards para redes sociais: usuários autenticados OU cron com chave
  const cronKey = new URL(req.url).searchParams.get("key");
  const isCron =
    !!process.env.CRON_SECRET && cronKey === process.env.CRON_SECRET;
  if (!isCron) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        return new Response("Login necessário", { status: 401 });
      }
    } catch {
      return new Response("Login necessário", { status: 401 });
    }
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

  // imageUrl nem sempre e imagem de verdade — feed ja mandou URL de
  // pagina HTML (ex.: pcyes.com.br/produto). next/og quebra com 502
  // ("Unsupported image type"). Se nao for imagem, tenta resolver o
  // og:image da pagina e grava de volta no produto (corrige o card E
  // o site). Sem imagem resolvida, o card sai so com titulo/preco.
  let imageUrl = product.imageUrl;
  if (imageUrl) {
    const isImage = async (method: "HEAD" | "GET", url = imageUrl!) => {
      const r = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      return r.ok && (r.headers.get("content-type") ?? "").startsWith("image/");
    };
    const resolveOgImage = async (pageUrl: string) => {
      try {
        const html = await fetch(pageUrl, {
          redirect: "follow",
          signal: AbortSignal.timeout(10000),
          headers: { "User-Agent": "Mozilla/5.0" },
        }).then((r) => (r.ok ? r.text() : ""));
        const m =
          html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ??
          html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
        if (!m) return null;
        // og:image costuma vir com &amp; escapado no HTML
        const abs = new URL(m[1].replace(/&amp;/g, "&"), pageUrl).toString();
        // Candidatos: og:image direto + url interna de otimizadores
        // (_next/image?url=..., /imgproxy/... ) — o otimizador as vezes
        // rejeita (400) mas a URL de origem responde imagem de verdade.
        const candidates = [abs];
        try {
          const inner = new URL(abs).searchParams.get("url");
          if (inner) candidates.push(new URL(inner, abs).toString());
        } catch {}
        for (const c of candidates) {
          if ((await isImage("HEAD", c)) || (await isImage("GET", c))) {
            return c;
          }
        }
        return null;
      } catch {
        return null;
      }
    };
    try {
      if (!(await isImage("HEAD")) && !(await isImage("GET"))) {
        const resolved = await resolveOgImage(imageUrl);
        if (resolved) {
          imageUrl = resolved;
          await prisma.product
            .update({ where: { id: product.id }, data: { imageUrl: resolved } })
            .catch(() => {});
        } else {
          imageUrl = null;
        }
      }
    } catch {
      imageUrl = null;
    }
  }

  // Baixa a imagem AQUI (com retry/UA/timeout) e embute como data
  // URI — o renderer do next/og nunca busca na rede. Se a CDN da
  // loja bloquear ou o formato for webp, o card sai com a foto
  // convertida em vez de quebrar ou sair sem imagem.
  const imageSrc = imageUrl ? await imageToDataUri(imageUrl) : null;

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
  // Logo remoto tambem vira data URI — um <img> que falha derruba o
  // ImageResponse inteiro (card nao e gerado = anexo some do email)
  const storeLogoSrc =
    storeLogoUrl && /^https?:\/\//.test(storeLogoUrl)
      ? await imageToDataUri(storeLogoUrl)
      : storeLogoUrl;

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
                <svg width="120" height="30" viewBox={AMZ_SMILE_VIEWBOX}>
                  {AMZ_SMILE_PATHS.map((d) => (
                    <path key={d.slice(0, 24)} d={d} fill="#ff9900" />
                  ))}
                </svg>
              ) : storeLogoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={storeLogoSrc}
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
                  fontWeight: 800,
                  color: "#99f6e4",
                  letterSpacing: 1,
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
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
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
