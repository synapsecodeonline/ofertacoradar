import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { SITE_NAME, SITE_TAGLINE, siteUrl } from "@/lib/site";
import { IconTag } from "@/components/Icons";
import ThemeToggle from "@/components/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Cupons, ofertas e produtos selecionados das melhores lojas. Ofertas verificadas com links diretos para aproveitar o desconto.",
  keywords: [
    "cupons de desconto",
    "ofertas",
    "promocao",
    "cupom",
    "desconto",
    "black friday",
    "ofertas do dia",
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      "Cupons, ofertas e produtos selecionados das melhores lojas. Ofertas verificadas com links diretos.",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      "Cupons, ofertas e produtos selecionados das melhores lojas.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {/* Aplica tema salvo antes do paint (evita flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
        {/* Barra de anuncio (rola para fora) */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-center text-xs font-semibold text-white">
          <p className="px-4 py-1.5">
            Ofertas verificadas diariamente · Links de parceiro, sem custo
            extra para você
          </p>
        </div>

        <header className="sticky top-0 z-10 border-b border-zinc-200/60 bg-white/80 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-950/80">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
            <Link
              href="/"
              className="group flex items-center gap-2 text-lg font-extrabold tracking-tight"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm transition-transform group-hover:scale-105">
                <IconTag className="h-4.5 w-4.5" />
              </span>
              Ofertaço <span className="text-emerald-600">Radar</span>
            </Link>
            <div className="flex items-center gap-2">
              <nav className="flex items-center gap-1 rounded-full border border-zinc-200/70 bg-zinc-100/70 p-1 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-900/70">
              <Link
                href="/?aba=produtos"
                className="rounded-full px-4 py-1.5 text-zinc-600 transition-all hover:bg-white hover:text-emerald-600 hover:shadow-sm dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Produtos
              </Link>
              <Link
                href="/?aba=ofertas"
                className="rounded-full px-4 py-1.5 text-zinc-600 transition-all hover:bg-white hover:text-emerald-600 hover:shadow-sm dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Ofertas e Cupons
              </Link>
              <Link
                href="/#relampago"
                className="hidden rounded-full px-4 py-1.5 text-zinc-600 transition-all hover:bg-white hover:text-amber-600 hover:shadow-sm dark:text-zinc-300 dark:hover:bg-zinc-800 sm:inline-block"
              >
                ⚡ Relâmpago
              </Link>
              </nav>
              <ThemeToggle />
            </div>
          </div>
        </header>
        {children}
        <footer className="mt-auto border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex max-w-sm flex-col gap-2">
              <p className="flex items-center gap-2 text-base font-extrabold tracking-tight">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                  <IconTag className="h-4 w-4" />
                </span>
                Ofertaço <span className="text-emerald-600">Radar</span>
              </p>
              <p className="text-xs leading-relaxed text-zinc-400">
                {SITE_NAME} é um site de ofertas com links de parceiro
                (afiliado). Podemos receber comissão pelas compras realizadas
                através dos nossos links, sem custo extra para você. Os preços e
                cupons são exibidos conforme as informações das lojas parceiras
                e podem sofrer alterações.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Navegação
              </p>
              <Link href="/?aba=produtos" className="text-zinc-500 transition-colors hover:text-emerald-600 dark:text-zinc-400">
                Produtos em oferta
              </Link>
              <Link href="/?aba=ofertas" className="text-zinc-500 transition-colors hover:text-emerald-600 dark:text-zinc-400">
                Ofertas e cupons
              </Link>
            </div>
            <div className="flex flex-col gap-2 text-xs text-zinc-400">
              <p>
                © {new Date().getFullYear()} {SITE_NAME}. Todos os direitos
                reservados.
              </p>
              <p>{SITE_TAGLINE}.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
