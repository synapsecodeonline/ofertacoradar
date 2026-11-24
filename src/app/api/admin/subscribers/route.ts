import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/admin";
import { csvField } from "@/lib/csv";

export const dynamic = "force-dynamic";

// GET /api/admin/subscribers — CSV dos emails capturados (admin only).
export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Login necessário" }, { status: 401 });
  }

  const rows = await prisma.subscriber.findMany({
    orderBy: { createdAt: "desc" },
    select: { email: true, productId: true, createdAt: true },
  });

  const lines = rows.map((r) =>
    [
      r.createdAt.toISOString(),
      csvField(r.email),
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
