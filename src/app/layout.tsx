import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { SITE_NAME, SITE_TAGLINE, siteUrl } from "@/lib/site";
import { IconInstagram, IconTag } from "@/components/Icons";
import ThemeToggle from "@/components/ThemeToggle";
import HashLink from "@/components/HashLink";
import AuthButton from "@/components/AuthButton";
import PageViewTracker from "@/components/PageViewTracker";
import DbStatusBanner from "@/components/DbStatusBanner";
import NavProgress from "@/components/NavProgress";
import SkipLink from "@/components/SkipLink";

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
    "Ofertas de verdade verificadas todo dia: produtos, promoções e cupons de Amazon, Mercado Livre, Lomadee e mais. Preço real, desconto real.",
  keywords: [
    "ofertas",
    "ofertas do dia",
    "cupons de desconto",
    "cupom de desconto",
    "promocoes",
    "promocao",
    "desconto",
    "black friday",
    "ofertas mercadolivre",
    "ofertas online",
    "comprar com desconto",
    "melhores ofertas",
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      "Ofertas de verdade verificadas todo dia: produtos, promoções e cupons das maiores lojas do Brasil.",
    images: [{ url: "/api/og", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description:
      "Ofertas de verdade verificadas todo dia: produtos, promoções e cupons das maiores lojas do Brasil.",
    images: ["/api/og"],
  },
  robots: { index: true, follow: true },
  // verificacao do canal na Lomadee
  other: { lomadee: "2324685" },
  // verificacao do dominio no Google Search Console
  verification: { google: "tpoZjN1_dAX3P0NXtxz00WH0Qyd6GesrCf9fR3RHjh0" },
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
        {/* Pixels de remarketing — so carrega se o ID estiver configurado.
            NEXT_PUBLIC_META_PIXEL_ID / NEXT_PUBLIC_GA_ID na Vercel. */}
        {process.env.NEXT_PUBLIC_META_PIXEL_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${process.env.NEXT_PUBLIC_META_PIXEL_ID}');fbq('track','PageView');`,
            }}
          />
        )}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_ID}');`,
              }}
            />
          </>
        )}
        <SkipLink />
        {/* Barra de anuncio (rola para fora) */}
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-center text-xs font-semibold text-white">
          <p className="px-4 py-1.5">
            Ofertas verificadas diariamente · Preço real, desconto real — sem pegadinha
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
              <nav className="hidden items-center gap-1 rounded-full border border-zinc-200/70 bg-zinc-100/70 p-1 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-900/70 sm:flex">
              <HashLink
                href="/"
                className="rounded-full px-4 py-1.5 text-zinc-600 transition-all hover:bg-white hover:text-emerald-600 hover:shadow-sm dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Produtos
              </HashLink>
              <HashLink
                href="/?aba=cupons"
                className="rounded-full px-4 py-1.5 text-zinc-600 transition-all hover:bg-white hover:text-emerald-600 hover:shadow-sm dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cupons
              </HashLink>
              </nav>
              <AuthButton />
              <ThemeToggle />
            </div>
          </div>
          {/* Menu mobile: fileira de pills com scroll horizontal */}
          <nav className="flex items-center gap-1 overflow-x-auto border-t border-zinc-200/60 px-4 py-2 [scrollbar-width:none] dark:border-zinc-800/60 sm:hidden [&::-webkit-scrollbar]:hidden">
              <HashLink
                href="/"
                className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:text-zinc-300 dark:hover:bg-emerald-950/40"
              >
                Produtos
              </HashLink>
              <HashLink
                href="/?aba=cupons"
                className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:text-zinc-300 dark:hover:bg-emerald-950/40"
              >
                Cupons
              </HashLink>
          </nav>
        </header>
        <DbStatusBanner />
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
                (Lomadee, Mercado Livre, Awin e Amazon) e podem sofrer alterações.
              </p>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Navegação
              </p>
              <Link href="/" className="text-zinc-500 transition-colors hover:text-emerald-600 dark:text-zinc-400">
                Produtos
              </Link>
              <Link href="/?aba=cupons" className="text-zinc-500 transition-colors hover:text-emerald-600 dark:text-zinc-400">
                Cupons
              </Link>
              <Link href="/politica-de-devolucao" className="text-zinc-500 transition-colors hover:text-emerald-600 dark:text-zinc-400">
                Devolução e troca
              </Link>
              <Link href="/politica-de-privacidade" className="text-zinc-500 transition-colors hover:text-emerald-600 dark:text-zinc-400">
                Privacidade
              </Link>
              <a
                href={
                  process.env.NEXT_PUBLIC_INSTAGRAM_URL ??
                  "https://instagram.com/ofertacoradar"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-fuchsia-600 dark:text-zinc-400"
              >
                <IconInstagram className="h-4 w-4" /> Instagram
              </a>
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
        <PageViewTracker />
        <NavProgress />
      </body>
    </html>
  );
}
