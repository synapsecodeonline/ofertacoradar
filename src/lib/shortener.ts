import { prisma } from "@/lib/db";

// Gera (e cacheia) um link lomadee rastreado para uma URL de produto.
// Retorna null quando a organizacao nao permite o canal do afiliado.
export async function getTrackedUrl(
  sourceUrl: string,
  organizationId: string,
): Promise<string | null> {
  const cached = await prisma.trackedLink
    .findUnique({ where: { sourceUrl } })
    .catch(() => null);
  if (cached) return cached.shortUrl;

  const apiKey = process.env.LOMADEE_API_KEY;
  const baseUrl = process.env.LOMADEE_API_URL ?? "https://api.lomadee.com.br";
  if (!apiKey) return null;

  try {
    const res = await fetch(`${baseUrl}/affiliate/shortener/url`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "Custom",
        url: sourceUrl,
        organizationId,
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { shortUrls?: string[] }[];
    const shortUrl = Array.isArray(json)
      ? (json.find((c) => c.shortUrls?.length)?.shortUrls?.[0] ?? null)
      : null;
    if (!shortUrl) return null;

    await prisma.trackedLink
      .create({ data: { sourceUrl, organizationId, shortUrl } })
      .catch(() => {});
    return shortUrl;
  } catch {
    return null;
  }
}
