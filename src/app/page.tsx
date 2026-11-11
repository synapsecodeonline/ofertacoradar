import Link from "next/link";
import { prisma } from "@/lib/db";
import ProductCard from "@/components/ProductCard";
import { categoryLabel } from "@/lib/categories";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { q, categoria } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const category = typeof categoria === "string" ? categoria : "";

  const where = {
    active: true,
    externalId: { startsWith: "camp:" },
    ...(category ? { category: { contains: category } } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query } },
            { description: { contains: query } },
            { merchant: { contains: query } },
          ],
        }
      : {}),
  };

  const [offers, categories, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 96,
    }),
    prisma.product.findMany({
      where: { active: true, externalId: { startsWith: "camp:" }, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
    }),
    prisma.product.count({
      where: { active: true, externalId: { startsWith: "camp:" } },
    }),
  ]);

  const categoryList = categories
    .map((c) => c.category)
    .filter((c): c is string => !!c)
    .sort();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4">
      {/* Hero */}
      <section className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="rounded-full bg-emerald-100 px-4 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {total} ofertas ativas
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Oferta<span className="text-emerald-600">ço</span>
        </h1>
        <p className="max-w-md text-zinc-500 dark:text-zinc-400">
          Cupons e ofertas selecionadas das melhores lojas. Clique, ganhe o
          desconto na loja parceira.
        </p>
        <form action="/" method="get" className="mt-2 flex w-full max-w-md gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Buscar oferta ou loja..."
            className="flex-1 rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            Buscar
          </button>
        </form>
      </section>

      {categoryList.length > 0 && (
        <nav className="mb-6 flex flex-wrap justify-center gap-2">
          {categoryList.map((cat) => (
            <Link
              key={cat}
              href={`/?categoria=${encodeURIComponent(cat)}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                category === cat
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-zinc-600 shadow-sm hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {categoryLabel(cat)}
            </Link>
          ))}
        </nav>
      )}

      {offers.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">
          Nenhuma oferta encontrada. Rode <code>npm run sync</code> para
          importar.
        </p>
      ) : (
        <main className="grid grid-cols-2 gap-4 pb-12 sm:grid-cols-3 lg:grid-cols-4">
          {offers.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </main>
      )}
    </div>
  );
}
