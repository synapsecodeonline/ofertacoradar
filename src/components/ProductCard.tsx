import Link from "next/link";
import Image from "next/image";
import type { Product } from "@prisma/client";
import { discountPercent, formatPrice } from "@/lib/format";
import { urgencyLabel } from "@/lib/urgency";

export default function ProductCard({ product }: { product: Product }) {
  const discount = discountPercent(product.price, product.oldPrice);
  const urgent = urgencyLabel(product.endsAt);

  return (
    <Link
      href={`/produto/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="relative aspect-square bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-3 transition-transform group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-400">
            sem imagem
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {discount !== null && (
            <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-extrabold text-white shadow">
              -{discount}%
            </span>
          )}
          {urgent && (
            <span className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white shadow">
              {urgent}
            </span>
          )}
        </div>
        {product.couponCode && (
          <span className="absolute bottom-2 left-2 rounded-md bg-zinc-900/90 px-2 py-1 font-mono text-xs font-bold text-amber-300">
            {product.couponCode}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          {product.title}
        </h3>
        {product.merchant && (
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {product.merchant}
          </span>
        )}
        <div className="mt-auto flex items-baseline gap-2 pt-1">
          {product.price != null && (
            <span className="text-base font-extrabold text-emerald-600">
              {formatPrice(product.price, product.currency)}
            </span>
          )}
          {product.oldPrice != null &&
            product.oldPrice > (product.price ?? 0) && (
              <span className="text-xs text-zinc-400 line-through">
                {formatPrice(product.oldPrice, product.currency)}
              </span>
            )}
        </div>
      </div>
    </Link>
  );
}
