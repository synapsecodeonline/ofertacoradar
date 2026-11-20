import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/admin/subscribers — CSV dos emails capturados (admin only).
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return Response.json({ error: "Login necessário" }, { status: 401 });
  }

  const rows = await prisma.subscriber.findMany({
    orderBy: { createdAt: "desc" },
    select: { email: true, productId: true, createdAt: true },
  });

  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [
      r.createdAt.toISOString(),
      esc(r.email),
      r.productId ?? "",
    ].join(","),
  );

  return new Response(
    ["data,email,produto_id", ...lines].join("\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="subscribers.csv"',
      },
    },
  );
}
