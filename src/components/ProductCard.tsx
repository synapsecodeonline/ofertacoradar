import Link from "next/link";
import Image from "next/image";
import type { Product } from "@prisma/client";
import { discountPercent, formatPrice, imgSrc } from "@/lib/format";
import { urgencyLabel } from "@/lib/urgency";
import { merchantLogo } from "@/lib/store-logo";
import { sourceBadgeOf } from "@/lib/sources";
import { AmazonMark } from "@/components/AmazonMark";
import { IconArrowRight, IconFlame, IconTag } from "@/components/Icons";

export default async function ProductCard({
  product,
  clicks,
  showSource = false,
}: {
  product: Product;
  clicks?: number;
  showSource?: boolean;
}) {
  const logo = await merchantLogo(product.merchant);
  const isAmazon =
    product.externalId?.startsWith("amz:") ||
    product.merchant?.toLowerCase() === "amazon";
  const source = showSource ? sourceBadgeOf(product.externalId) : null;
  const discount = product.discountPct ?? discountPercent(product.price, product.oldPrice);
  const urgent = urgencyLabel(product.endsAt);
  const hasPrice = product.price != null;
  const saving =
    product.price != null &&
    product.oldPrice != null &&
    product.oldPrice > product.price
      ? product.oldPrice - product.price
      : null;

  return (
    <Link
      href={`/produto/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-600/10 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-800"
    >
      {/* Imagem */}
      <div className="relative aspect-square bg-zinc-50 dark:bg-zinc-950">
        {product.imageUrl ? (
          <Image
            src={imgSrc(product.imageUrl)!}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-4 transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            unoptimized
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-300 dark:text-zinc-700">
            <IconTag className="h-10 w-10" />
          </div>
        )}

        {/* Badge de desconto */}
        {discount !== null && (
          <span className="absolute left-2.5 top-2.5 rounded-lg bg-gradient-to-br from-red-500 to-red-600 px-2.5 py-1 text-xs font-extrabold text-white shadow-md">
            -{discount}%
          </span>
        )}
        {urgent && (
          <span className="absolute right-2.5 top-2.5 rounded-lg bg-zinc-900/85 px-2 py-1 text-[11px] font-bold text-amber-300 shadow backdrop-blur-sm dark:bg-white/90 dark:text-amber-600">
            {urgent}
          </span>
        )}

        {/* Cupom */}
        {product.couponCode && (
          <span className="absolute bottom-2.5 left-2.5 max-w-[calc(100%-1.25rem)] truncate rounded-md border border-dashed border-amber-400/60 bg-zinc-900/90 px-2 py-1 font-mono text-[11px] font-bold tracking-wide text-amber-300 backdrop-blur-sm">
            {product.couponCode}
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug text-zinc-900 transition-colors group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-emerald-400">
          {product.title}
        </h3>
        {source && (
          <span
            className={`w-fit rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${source.className}`}
          >
            {source.label}
          </span>
        )}
        {product.merchant && (
          <span className="flex items-center gap-1.5 truncate text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {isAmazon ? (
              <AmazonMark />
            ) : logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-4 w-4 shrink-0 rounded-sm bg-white object-contain p-px ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700"
              />
            ) : (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-zinc-100 text-[9px] font-extrabold text-zinc-400 dark:bg-zinc-800">
                {product.merchant.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate">{product.merchant}</span>
          </span>
        )}
        {clicks != null && clicks >= 3 && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-orange-500 dark:text-orange-400">
            <IconFlame className="h-3 w-3" />
            {clicks} {clicks === 1 ? "pessoa aproveitou" : "pessoas aproveitaram"}
          </span>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex flex-col">
            {hasPrice ? (
              <span className="text-lg font-extrabold leading-none text-emerald-600 dark:text-emerald-400">
                {formatPrice(product.price, product.currency)}
              </span>
            ) : (
              <span className="text-sm font-bold text-zinc-500">Ver oferta</span>
            )}
            {product.oldPrice != null &&
              product.oldPrice > (product.price ?? 0) && (
                <span className="mt-1 text-xs text-zinc-500 line-through">
                  {formatPrice(product.oldPrice, product.currency)}
                </span>
              )}
            {saving !== null && saving >= 10 && (
              <span className="mt-0.5 text-[11px] font-bold leading-tight text-emerald-600 dark:text-emerald-400">
                Economize {formatPrice(saving, product.currency)}
              </span>
            )}
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition-all duration-300 group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-950 dark:text-emerald-400 dark:group-hover:bg-emerald-500 dark:group-hover:text-white" aria-hidden="true">
            <IconArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
