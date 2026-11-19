import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { PV_EXTERNAL_ID } from "@/app/api/pv/route";

export const dynamic = "force-dynamic";

// GET /api/admin/export — CSV dos cliques dos últimos 30 dias (admin only).
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return Response.json({ error: "Login necessário" }, { status: 401 });
  }

  const d30 = new Date(Date.now() - 30 * 86_400_000);
  const pv = await prisma.product.findUnique({
    where: { externalId: PV_EXTERNAL_ID },
    select: { id: true },
  });

  const rows = await prisma.$queryRawUnsafe<
    {
      createdAt: Date;
      title: string;
      merchant: string | null;
      src: string | null;
      referer: string | null;
    }[]
  >(
    `SELECT c."createdAt", p.title, p.merchant,
            CASE
              WHEN p."externalId" LIKE 'camp-lomadee:%' OR p."externalId" LIKE 'prod-lomadee:%' THEN 'lomadee'
              WHEN p."externalId" LIKE 'ml:%' THEN 'ml'
              WHEN p."externalId" LIKE 'aw:%' THEN 'awin'
              ELSE 'outros' END AS src,
            c.referer
     FROM "Click" c JOIN "Product" p ON p.id = c."productId"
     WHERE c."createdAt" >= $1 AND c."productId" <> $2
     ORDER BY c."createdAt" DESC
     LIMIT 50000`,
    d30,
    pv?.id ?? -1,
  );

  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = "data,produto,loja,fonte,referer";
  const lines = rows.map((r) =>
    [
      r.createdAt.toISOString(),
      esc(r.title),
      esc(r.merchant),
      esc(r.src),
      esc(r.referer),
    ].join(","),
  );

  return new Response([header, ...lines].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cliques-30d.csv"',
    },
  });
}
