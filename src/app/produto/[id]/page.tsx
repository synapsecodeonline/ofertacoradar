import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { discountPercent, formatPrice } from "@/lib/format";
import { urgencyLabel } from "@/lib/urgency";
import { categoryLabel } from "@/lib/categories";
import CopyCoupon from "@/components/CopyCoupon";
import ProductCard from "@/components/ProductCard";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: PageProps<"/produto/[id]">) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id: Number(id) },
  });
  if (!product || !product.active) notFound();

  const discount = discountPercent(product.price, product.oldPrice);
  const urgent = urgencyLabel(product.endsAt);

  const related = product.category
    ? await prisma.product.findMany({
        where: {
          active: true,
          externalId: { startsWith: "camp:" },
          category: product.category,
          NOT: { id: product.id },
        },
        orderBy: { updatedAt: "desc" },
        take: 4,
      })
    : [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8">
      <Link href="/" className="text-sm font-medium text-zinc-500 hover:text-emerald-600">
        ← Voltar às ofertas
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-100 to-zinc-200 dark:border-zinc-800 dark:from-zinc-800 dark:to-zinc-900">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.title}
              className="h-full w-full object-contain p-8"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400">
              sem imagem
            </div>
          )}
          {discount !== null && (
            <span className="absolute left-4 top-4 rounded-full bg-red-600 px-3 py-1 text-sm font-extrabold text-white">
              -{discount}%
            </span>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {product.category && (
            <Link
              href={`/?categoria=${encodeURIComponent(product.category)}`}
              className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {categoryLabel(product.category)}
            </Link>
          )}
          <h1 className="text-2xl font-extrabold leading-tight">
            {product.title}
          </h1>
          {product.merchant && (
            <span className="text-sm font-medium text-zinc-500">
              {product.merchant}
            </span>
          )}

          {(product.price != null ||
            (product.oldPrice != null &&
              product.oldPrice > (product.price ?? 0))) && (
            <div className="flex items-baseline gap-3">
              {product.price != null && (
                <span className="text-3xl font-extrabold text-emerald-600">
                  {formatPrice(product.price, product.currency)}
                </span>
              )}
              {product.oldPrice != null &&
                product.oldPrice > (product.price ?? 0) && (
                  <>
                    <span className="text-lg text-zinc-400 line-through">
                      {formatPrice(product.oldPrice, product.currency)}
                    </span>
                    {discount !== null && (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-sm font-bold text-white">
                        -{discount}%
                      </span>
                    )}
                  </>
                )}
            </div>
          )}

          {urgent && (
            <p className="w-fit rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              ⏰ {urgent} — aproveite antes que acabe
            </p>
          )}

          {product.couponCode && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                Cupom de desconto:
              </span>
              <CopyCoupon code={product.couponCode} />
            </div>
          )}

          {product.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {product.description}
            </p>
          )}

          <a
            href={`/ir/${product.id}`}
            className="mt-2 inline-flex h-14 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 hover:shadow-xl"
          >
            {product.couponCode
              ? "Ir para a loja e usar cupom"
              : "Ver oferta na loja"}
          </a>
          <p className="text-xs text-zinc-400">
            Link de parceiro — podemos receber comissão pela compra, sem custo
            extra para você.
          </p>
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">Ofertas relacionadas</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
