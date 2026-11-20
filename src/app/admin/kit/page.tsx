import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getInstagramKit } from "@/lib/instagramKit";
import { formatPrice } from "@/lib/format";
import CopyCaption from "@/components/CopyCaption";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kit Instagram", robots: { index: false } };

// Nome de arquivo amigavel: "01-air-fryer-philips-5l-feed.png"
function fileSlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Painel de conteudo diario: ofertas sem expiracao com imagem e
// legenda prontas para baixar/copiar e postar no Instagram.
export default async function AdminKitPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const kit = await getInstagramKit(12);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/admin"
            className="text-xs font-semibold text-zinc-500 hover:text-emerald-600"
          >
            ← Admin
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
            Kit Instagram — ofertas do dia
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {kit.items.length} ofertas sem data de expiração · gerado em{" "}
            {new Date(kit.generatedAt).toLocaleString("pt-BR")}
          </p>
        </div>
        <a
          href="/api/instagram/kit?count=20"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-700"
        >
          Versão JSON (20 itens)
        </a>
      </header>

      {kit.items.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">
          Nenhuma oferta elegível no momento — tente novamente mais tarde.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3">
          {kit.items.map((item, i) => {
            const num = String(i + 1).padStart(2, "0");
            const slug = fileSlug(item.title);
            return (
            <article
              key={item.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <a
                href={item.cardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-square bg-zinc-100 dark:bg-zinc-800"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.cardUrl}
                  alt={item.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </a>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">
                  #{i + 1} · {item.merchant ?? "Loja"}
                  {item.discountPct != null && ` · -${Math.round(item.discountPct)}%`}
                </p>
                <h2 className="line-clamp-2 text-sm font-bold leading-snug">
                  {item.title}
                </h2>
                {item.price != null && (
                  <p className="text-sm">
                    <span className="font-extrabold text-emerald-600">
                      {formatPrice(item.price, item.currency)}
                    </span>
                    {item.oldPrice != null && item.oldPrice > item.price && (
                      <span className="ml-2 text-xs text-zinc-400 line-through">
                        {formatPrice(item.oldPrice, item.currency)}
                      </span>
                    )}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <a
                    href={item.cardUrl}
                    download={`${num}-${slug}-feed.png`}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    ↓ Feed
                  </a>
                  <a
                    href={item.cardStoryUrl}
                    download={`${num}-${slug}-story.png`}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    ↓ Story
                  </a>
                  <CopyCaption text={item.caption} />
                  <a
                    href={item.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-500 hover:text-emerald-700 dark:border-zinc-700"
                  >
                    Ver oferta
                  </a>
                </div>
              </div>
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
