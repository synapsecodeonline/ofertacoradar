import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// A home canonica e /ofertas-do-dia — preserva todos os query params
// (aba, q, categoria, loja, ordem, tipo, pagina) no redirect.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) p.set(k, val);
  }
  const qs = p.toString();
  redirect(`/ofertas-do-dia${qs ? `?${qs}` : ""}`);
}
