import Link from "next/link";
import { after } from "next/server";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { maybeSyncLomadee, maybeSyncML } from "@/lib/syncer";
import { siteUrl } from "@/lib/site";
import ProductCard from "@/components/ProductCard";
import { IconTag } from "@/components/Icons";
import CollapsibleSection from "@/components/CollapsibleSection";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Cupons do dia",
    description:
      "Cupons e ofertas exclusivas do dia nas lojas parceiras. Copie o cupom e aproveite o desconto no checkout.",
    keywords: [
      "cupons de desconto",
      "cupom",
      "cupons do dia",
      "codigo promocional",
      "promocoes",
    ],
    alternates: { canonical: `${siteUrl()}/cupons` },
    openGraph: {
      title: "Cupons do dia | Ofertaço Radar",
      description:
        "Cupons e ofertas exclusivas do dia nas lojas parceiras. Copie o cupom e aproveite o desconto.",
      url: `${siteUrl()}/cupons`,
      images: [{ url: "/api/og", width: 1200, height: 630 }],
    },
  };
}

const PAGE_SIZE = 24;

// So cupons/ofertas Lomadee (camp-lomadee:) — nunca produtos de catalogo.
const VALID = {
  active: true,
  imageUrl: { not: null },
  externalId: { startsWith: "camp-lomadee:" },
  AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] }],
};

export default async function CuponsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  // Sync das fontes a cada pageview (nunca bloqueia a resposta).
  // Retornar a promise e obrigatorio: sem isso o after() resolve na
  // hora e a function congela logo apos a resposta, matando o sync.
  after(() =>
    Promise.all([
      maybeSyncLomadee().catch(() => {}),
      maybeSyncML().catch(() => {}),
    ]),
  );

  const cpage = Math.max(1, Number(sp.cpage) || 1);

  // Cupons que expiram primeiro aparecem primeiro; sem validade por ultimo.
  const coupons = await prisma.product.findMany({
    where: VALID,
    orderBy: [{ endsAt: { sort: "asc", nulls: "last" } }, { id: "desc" }],
  });

  const totalPages = Math.max(1, Math.ceil(coupons.length / PAGE_SIZE));
  const pageSafe = Math.min(cpage, totalPages);
  const items = coupons.slice(
    (pageSafe - 1) * PAGE_SIZE,
    pageSafe * PAGE_SIZE,
  );

  const pageQs = (page: number) => {
    const s = page > 1 ? `?cpage=${page}` : "";
    return `/cupons${s}`;
  };

  const withCode = coupons.filter((c) => c.couponCode).length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2">
        <nav className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
          <Link href="/" className="transition-colors hover:text-emerald-600">
            Início
          </Link>
          <span>/</span>
          <span className="text-zinc-500">Cupons do dia</span>
        </nav>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Cupons do dia
        </h1>
        <p className="max-w-xl text-sm text-zinc-500">
          Ofertas e códigos promocionais das lojas parceiras. Copie o cupom e
          use no checkout — sem cadastro, sem custo extra.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">
          Nenhum cupom ativo no momento. Volte em breve!
        </p>
      ) : (
        <CollapsibleSection
          className="border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20"
          title={
            <span className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                Cupons do dia
              </span>
              <span className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
                Ofertas ativas
              </span>
            </span>
          }
          meta={
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {coupons.length} cupons · {withCode} com código
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-4 pb-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} showSource />
            ))}
          </div>
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-4 pt-4 text-sm">
              {pageSafe > 1 && (
                <Link
                  href={pageQs(pageSafe - 1)}
                  className="rounded-full bg-white px-4 py-2 font-medium shadow-sm hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  ← Anterior
                </Link>
              )}
              <span className="text-zinc-500">
                Página {pageSafe} de {totalPages}
              </span>
              {pageSafe < totalPages && (
                <Link
                  href={pageQs(pageSafe + 1)}
                  className="rounded-full bg-white px-4 py-2 font-medium shadow-sm hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  Próxima →
                </Link>
              )}
            </nav>
          )}
        </CollapsibleSection>
      )}

      <p className="flex items-center gap-2 pb-8 text-center text-xs text-zinc-400">
        <IconTag className="h-3.5 w-3.5" />
        Cupons e ofertas verificados nas lojas parceiras — podem expirar sem
        aviso.
      </p>
    </div>
  );
}
