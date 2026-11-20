// Skeleton da home: aparece durante a navegacao server-side enquanto
// o banco responde — elimina a sensacao de "travou" em conexoes lentas.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8" aria-busy="true" aria-label="Carregando ofertas">
      <div className="mb-6 h-8 w-56 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-24 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="aspect-square animate-pulse bg-zinc-100 dark:bg-zinc-800" />
            <div className="flex flex-col gap-2 p-3.5">
              <div className="h-3.5 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
              <div className="mt-1 h-5 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
