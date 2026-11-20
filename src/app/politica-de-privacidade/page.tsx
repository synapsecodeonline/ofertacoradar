import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: `Política de privacidade do ${SITE_NAME}: quais dados coletamos, como usamos e seus direitos (LGPD).`,
  alternates: { canonical: "/politica-de-privacidade" },
};

export default function PoliticaPrivacidadePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">
        Política de Privacidade
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Última atualização: {new Date().getFullYear()}
      </p>

      <div className="mt-6 flex flex-col gap-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        <section>
          <h2 className="mb-1.5 text-base font-bold text-zinc-800 dark:text-zinc-100">
            Quem somos
          </h2>
          <p>
            O {SITE_NAME} é uma plataforma de ofertas que reúne produtos de
            lojas parceiras com links de afiliado. Esta política explica quais
            dados tratamos e como, em conformidade com a LGPD (Lei
            13.709/2018).
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-zinc-800 dark:text-zinc-100">
            Dados que coletamos
          </h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Dados de navegação</strong>: páginas visitadas, cliques
              em ofertas, origem do tráfego (UTM) e identificador de sessão
              anônimo (cookie), usados para melhorar o site e medir a
              performance.
            </li>
            <li>
              <strong>E-mail</strong>: apenas quando você solicita alertas de
              preço ou newsletter — nunca compartilhado com terceiros para
              marketing deles.
            </li>
            <li>
              <strong>Dados de conta admin</strong>: e-mail e credenciais de
              acesso ao painel, gerenciados pelo Supabase Auth.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-zinc-800 dark:text-zinc-100">
            Como usamos
          </h2>
          <ul className="ml-5 list-disc space-y-1">
            <li>Exibir ofertas relevantes e medir o desempenho do site</li>
            <li>Enviar alertas de preço quando você solicita</li>
            <li>Melhorar produtos, categorias e experiência de navegação</li>
            <li>Cumprir obrigações legais</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-zinc-800 dark:text-zinc-100">
            Cookies e rastreamento
          </h2>
          <p>
            Usamos cookies essenciais (sessão, preferências de tema) e de
            medição de audiência. Ao clicar em uma oferta, você é redirecionado
            para a loja parceira — ela pode instalar seus próprios cookies de
            rastreamento conforme a política dela. Podemos usar pixels de
            mensuração (como Meta Pixel e Google Analytics) para entender a
            audiência e melhorar as campanhas.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-zinc-800 dark:text-zinc-100">
            Compartilhamento
          </h2>
          <p>
            Não vendemos seus dados. Compartilhamos apenas o necessário com
            operadores que nos auxiliam (hospedagem Vercel, banco Supabase,
            autenticação) e com as lojas parceiras quando você clica em um link
            de oferta — nesse caso, a loja recebe os dados padrão de navegação
            (URL de origem, etc.) para atribuição de comissão.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-zinc-800 dark:text-zinc-100">
            Seus direitos (LGPD)
          </h2>
          <p>
            Você pode solicitar acesso, correção ou exclusão dos seus dados a
            qualquer momento pelos nossos canais de contato. Também pode
            revogar consentimentos de cookies limpando os dados do navegador.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-zinc-800 dark:text-zinc-100">
            Contato
          </h2>
          <p>
            Dúvidas sobre privacidade ou dados pessoais: entre em contato
            pelos canais oficiais do {SITE_NAME}.
          </p>
        </section>
      </div>

      <p className="mt-8 text-xs text-zinc-400">
        Ver também: <Link href="/politica-de-devolucao" className="font-semibold text-emerald-600 hover:underline">Política de Devolução e Troca</Link>
      </p>
    </div>
  );
}
