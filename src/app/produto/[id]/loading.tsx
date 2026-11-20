export default function ProductLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8" aria-busy="true" aria-label="Carregando produto">
      <div className="mb-4 h-3 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid gap-8 md:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-3xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
        <div className="flex flex-col gap-4">
          <div className="h-4 w-24 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-9 w-full animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-9 w-3/4 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-14 w-48 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}
