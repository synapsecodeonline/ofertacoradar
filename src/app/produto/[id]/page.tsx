import { notFound } from "next/navigation";
import Link from "next/link";
import { after } from "next/server";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { maybeSync } from "@/lib/syncer";
import { discountPercent, formatPrice } from "@/lib/format";
import { urgencyLabel } from "@/lib/urgency";
import { categoryLabel } from "@/lib/categories";
import { siteUrl, SITE_NAME } from "@/lib/site";
import CopyCoupon from "@/components/CopyCoupon";
import CountdownTimer from "@/components/CountdownTimer";
import ProductCard from "@/components/ProductCard";
import { IconArrowRight, IconCheck, IconShield, IconTag } from "@/components/Icons";

export const dynamic = "force-dynamic";

async function getProduct(id: number) {
  return prisma.product.findUnique({ where: { id } });
}

export async function generateMetadata({
  params,
}: PageProps<"/produto/[id]">): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(Number(id)).catch(() => null);
  if (!product || !product.active) return {};

  const title = product.title;
  const description =
    product.description?.slice(0, 160) ??
    `Oferta de ${product.title}${product.merchant ? ` na ${product.merchant}` : ""} com desconto. Aproveite antes que acabe.`;

  return {
    title,
    description,
    alternates: { canonical: `${siteUrl()}/produto/${product.id}` },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      title,
      description,
      images: product.imageUrl ? [product.imageUrl] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/produto/[id]">) {
  const { id } = await params;
  const product = await getProduct(Number(id));
  if (!product || !product.active) notFound();

  after(() => maybeSync().catch(() => {}));

  const discount = discountPercent(product.price, product.oldPrice);
  const urgent = urgencyLabel(product.endsAt);
  const showCountdown =
    // eslint-disable-next-line react-hooks/purity -- pagina e dinamica (force-dynamic)
    product.endsAt && product.endsAt.getTime() - Date.now() < 7 * 86_400_000;

  const prefix = product.externalId?.startsWith("camp:")
    ? "camp:"
    : product.externalId?.startsWith("prod:")
      ? "prod:"
      : null;
  const baseWhere: Prisma.ProductWhereInput = {
    active: true,
    ...(prefix ? { externalId: { startsWith: prefix } } : {}),
    AND: [
      { OR: [{ price: null }, { price: { not: 0 } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
    ],
    NOT: { id: product.id },
  };

  // Prioriza mesma loja; completa com mesma categoria
  const [sameMerchant, sameCategory] = await Promise.all([
    product.merchant
      ? prisma.product.findMany({
          where: { ...baseWhere, merchant: product.merchant },
          orderBy: { discountPct: { sort: "desc", nulls: "last" } },
          take: 4,
        })
      : Promise.resolve([]),
    product.category
      ? prisma.product.findMany({
          where: {
            ...baseWhere,
            category: product.category,
            ...(product.merchant ? { NOT: { merchant: product.merchant } } : {}),
          },
          orderBy: { discountPct: { sort: "desc", nulls: "last" } },
          take: 4,
        })
      : Promise.resolve([]),
  ]);
  const related = [...sameMerchant, ...sameCategory].slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description ?? undefined,
    image: product.imageUrl ?? undefined,
    brand: product.merchant ? { "@type": "Brand", name: product.merchant } : undefined,
    offers: {
      "@type": "Offer",
      url: `${siteUrl()}/produto/${product.id}`,
      priceCurrency: product.currency || "BRL",
      ...(product.price != null ? { price: product.price } : {}),
      availability: "https://schema.org/InStock",
      ...(product.endsAt ? { validThrough: product.endsAt.toISOString() } : {}),
      seller: product.merchant
        ? { "@type": "Organization", name: product.merchant }
        : { "@type": "Organization", name: SITE_NAME },
    },
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs font-medium text-zinc-400" aria-label="Breadcrumb">
        <Link href="/" className="transition-colors hover:text-emerald-600">
          Início
        </Link>
        <span>/</span>
        {product.category ? (
          <>
            <Link
              href={`/?categoria=${encodeURIComponent(product.category)}`}
              className="transition-colors hover:text-emerald-600"
            >
              {categoryLabel(product.category)}
            </Link>
            <span>/</span>
          </>
        ) : null}
        <span className="max-w-56 truncate text-zinc-500">{product.title}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-10">
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.title}
              className="h-full w-full object-contain p-10"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-300 dark:text-zinc-700">
              <IconTag className="h-16 w-16" />
            </div>
          )}
          {discount !== null && (
            <span className="absolute left-4 top-4 rounded-xl bg-gradient-to-br from-red-500 to-red-600 px-3.5 py-1.5 text-sm font-extrabold text-white shadow-lg">
              -{discount}%
            </span>
          )}
          {product.couponCode && (
            <span className="absolute bottom-4 left-4 rounded-lg border border-dashed border-amber-400/50 bg-zinc-900/90 px-2.5 py-1 font-mono text-xs font-bold text-amber-300 backdrop-blur-sm">
              {product.couponCode}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
          {product.category && (
            <Link
              href={`/?categoria=${encodeURIComponent(product.category)}`}
              className="w-fit rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
            >
              {categoryLabel(product.category)}
            </Link>
          )}
          <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">
            {product.title}
          </h1>
          {product.merchant && (
            <span className="inline-flex w-fit items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {product.merchant}
            </span>
          )}

          {(product.price != null ||
            (product.oldPrice != null &&
              product.oldPrice > (product.price ?? 0))) && (
            <div className="flex items-baseline gap-3">
              {product.price != null && (
                <span className="text-4xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
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

          {/* eslint-disable-next-line react-hooks/purity -- pagina e dinamica (force-dynamic) */}
          {product.endsAt && product.endsAt.getTime() > Date.now() && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                Oferta termina em
              </span>
              {showCountdown ? (
                <CountdownTimer endsAt={product.endsAt.toISOString()} />
              ) : urgent ? (
                <p className="w-fit rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  ⏰ {urgent} — aproveite antes que acabe
                </p>
              ) : null}
            </div>
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
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-3">
            <a
              href={`/ir/${product.id}`}
              className="group/cta inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-lg font-bold text-white shadow-lg shadow-emerald-600/30 transition-all hover:shadow-xl hover:shadow-emerald-600/40 active:scale-[0.99]"
            >
              {product.couponCode
                ? "Ir para a loja e usar cupom"
                : "Ver oferta na loja"}
              <IconArrowRight className="h-5 w-5 transition-transform group-hover/cta:translate-x-0.5" />
            </a>

            {/* Selos de confianca */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="flex flex-col items-center gap-1 rounded-xl bg-zinc-100/80 px-2 py-2.5 dark:bg-zinc-900">
                <IconCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-[10px] font-semibold leading-tight text-zinc-500 dark:text-zinc-400">
                  Oferta verificada
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl bg-zinc-100/80 px-2 py-2.5 dark:bg-zinc-900">
                <IconShield className="h-4 w-4 text-emerald-600" />
                <span className="text-[10px] font-semibold leading-tight text-zinc-500 dark:text-zinc-400">
                  Compra na loja oficial
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl bg-zinc-100/80 px-2 py-2.5 dark:bg-zinc-900">
                <IconTag className="h-4 w-4 text-emerald-600" />
                <span className="text-[10px] font-semibold leading-tight text-zinc-500 dark:text-zinc-400">
                  Sem custo extra
                </span>
              </div>
            </div>
            <p className="text-center text-[11px] text-zinc-400">
              Link de parceiro — podemos receber comissão pela compra, sem custo
              extra para você.
            </p>
          </div>

          {/* Como usar o cupom */}
          {product.couponCode && (
            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Como usar o cupom
              </p>
              <ol className="flex flex-col gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                <li className="flex gap-2">
                  <span className="font-bold text-amber-600">1.</span>
                  Clique em “Ir para a loja” acima
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-amber-600">2.</span>
                  Copie o código{" "}
                  <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                    {product.couponCode}
                  </code>{" "}
                  e cole no checkout
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-amber-600">3.</span>
                  Confira o desconto aplicado antes de finalizar
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {sameMerchant.length > 0 ? "Mais ofertas da loja" : "Ofertas relacionadas"}
            </h2>
            {product.category && (
              <Link
                href={`/?categoria=${encodeURIComponent(product.category)}`}
                className="text-sm font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
              >
                Ver todas →
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* CTA fixo no mobile */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-lg md:hidden dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            {product.price != null && (
              <span className="truncate text-lg font-extrabold leading-none text-emerald-600 dark:text-emerald-400">
                {formatPrice(product.price, product.currency)}
              </span>
            )}
            <span className="truncate text-xs text-zinc-500">
              {product.merchant ?? product.title}
            </span>
          </div>
          <a
            href={`/ir/${product.id}`}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 text-sm font-bold text-white shadow-lg shadow-emerald-600/30"
          >
            {product.couponCode ? "Usar cupom" : "Ver oferta"}
            <IconArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
      {/* respiro para o CTA fixo no mobile */}
      <div className="h-20 md:hidden" />
    </div>
  );
}
