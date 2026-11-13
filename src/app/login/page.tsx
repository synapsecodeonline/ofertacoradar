import type { Metadata } from "next";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Ofertaço <span className="text-emerald-600">Radar</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Entre para acessar recursos de criador (cards para redes sociais).
        </p>
        <div className="mt-6 flex justify-center">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
