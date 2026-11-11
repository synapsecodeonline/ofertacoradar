import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-emerald-600">404</p>
      <h1 className="text-2xl font-bold">Oferta não encontrada</h1>
      <p className="max-w-sm text-sm text-zinc-500">
        Este cupom ou produto pode ter expirado ou sido removado. Confira as
        ofertas disponíveis na página inicial.
      </p>
      <Link
        href="/"
        className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
      >
        Ver ofertas
      </Link>
    </div>
  );
}
