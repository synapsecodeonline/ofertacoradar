"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconArrowRight, IconClock, IconTag } from "@/components/Icons";

export interface FeaturedItem {
  id: number;
  title: string;
  merchant: string | null;
  imageUrl: string | null;
  priceLabel: string | null;
  oldPriceLabel: string | null;
  discount: number | null;
  urgent: string | null;
}

const INTERVAL_MS = 6000;

export default function FeaturedCarousel({ items }: { items: FeaturedItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const count = items.length;
  const go = useCallback(
    (dir: 1 | -1) => setIndex((i) => (i + dir + count) % count),
    [count],
  );

  useEffect(() => {
    if (paused || count <= 1) return;
    timer.current = setInterval(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, count]);

  if (count === 0) return null;
  const item = items[index];

  return (
    <div
      className="group/carousel relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Link
        href={`/produto/${item.id}`}
        key={item.id}
        className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/40 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/40 hover:bg-white/[0.09] sm:p-5"
      >
        <span className="absolute -top-3 left-5 z-10 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-zinc-950 shadow-lg">
          Oferta em destaque
        </span>

        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-white/10 sm:h-28 sm:w-28">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.title}
              fill
              sizes="112px"
              className="object-contain p-2"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-500">
              <IconTag className="h-8 w-8" />
            </div>
          )}
          {item.discount !== null && (
            <span className="absolute -right-1.5 -top-1.5 rounded-lg bg-red-500 px-2 py-0.5 text-xs font-extrabold text-white shadow">
              -{item.discount}%
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {item.merchant && (
            <span className="truncate text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              {item.merchant}
            </span>
          )}
          <h2 className="line-clamp-2 text-base font-bold leading-snug text-white transition-colors group-hover/carousel:text-emerald-300 sm:text-lg">
            {item.title}
          </h2>
          <div className="flex items-baseline gap-2">
            {item.priceLabel && (
              <span className="text-xl font-extrabold text-emerald-400">
                {item.priceLabel}
              </span>
            )}
            {item.oldPriceLabel && (
              <span className="text-xs text-zinc-500 line-through">
                {item.oldPriceLabel}
              </span>
            )}
          </div>
          {item.urgent && (
            <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
              <IconClock className="h-3 w-3" /> {item.urgent}
            </span>
          )}
          <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-zinc-950 transition-colors group-hover/carousel:bg-emerald-400">
            Ver oferta <IconArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>

      {/* Controles */}
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Oferta anterior"
            onClick={(e) => {
              e.preventDefault();
              go(-1);
            }}
            className="absolute -left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-zinc-900/80 text-white opacity-0 shadow-lg backdrop-blur transition-all hover:bg-zinc-800 group-hover/carousel:opacity-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button
            type="button"
            aria-label="Próxima oferta"
            onClick={(e) => {
              e.preventDefault();
              go(1);
            }}
            className="absolute -right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-zinc-900/80 text-white opacity-0 shadow-lg backdrop-blur transition-all hover:bg-zinc-800 group-hover/carousel:opacity-100"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <div className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir para oferta ${i + 1}`}
                onClick={(e) => {
                  e.preventDefault();
                  setIndex(i);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-emerald-400" : "w-1.5 bg-white/25 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
