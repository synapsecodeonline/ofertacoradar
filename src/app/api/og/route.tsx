import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE, siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// Imagem Open Graph padrao do site (1200x630) — usada em
// compartilhamentos quando a pagina nao define imagem propria.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #059669 0%, #0d9488 55%, #134e4a 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 88,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: -2,
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 36,
            fontWeight: 700,
            color: "#a7f3d0",
          }}
        >
          {SITE_TAGLINE}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 26,
            fontWeight: 600,
            color: "#d1fae5",
          }}
        >
          Ofertas verificadas diariamente · {new URL(siteUrl()).host}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
