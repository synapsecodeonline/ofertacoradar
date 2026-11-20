import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Política de Devolução e Troca",
  description: `Política de devolução e troca do ${SITE_NAME}: as compras são finalizadas nas lojas parceiras e seguem as regras de cada uma.`,
  alternates: { canonical: "/politica-de-devolucao" },
};

export default function PoliticaDevolucaoPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight">
        Política de Devolução e Troca
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Última atualização: {new Date().getFullYear()}
      </p>

      <div className="mt-6 flex flex-col gap-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
        <section>
          <h2 className="mb-1.5 text-base font-bold text-zinc-800 dark:text-zinc-100">
            Como funcionam as compras
          </h2>
          <p>
            O {SITE_NAME} é uma plataforma de ofertas que reúne produtos de
            lojas parceiras (como Amazon, Mercado Livre, Lomadee e outras). Ao
            clicar em uma oferta, você é direcionado para o site da loja
            vendedora, onde a compra é finalizada diretamente com ela.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-zinc-800 dark:text-zinc-100">
            Devoluções e trocas
          </h2>
          <p>
            Por não sermos o vendedor, <strong>o {SITE_NAME} não processa
            devoluções, trocas ou reembolsos</strong>. Esses processos seguem o
            Código de Defesa do Consumidor e as políticas individuais de cada
            loja parceira — por exemplo, a política de devolução da Amazon ou
            do Mercado Livre.
          </p>
          <p className="mt-2">
            Para solicitar uma devolução ou troca, acesse sua conta na loja
            onde a compra foi feita ou use o canal de atendimento dela (chat,
            e-mail ou central de ajuda). O prazo e as condições variam por loja
            e por produto.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-zinc-800 dark:text-zinc-100">
            Garantia e defeitos
          </h2>
          <p>
            A garantia dos produtos é oferecida pelo fabricante e/ou pela loja
            vendedora. Em caso de defeito, entre em contato com a loja onde a
            compra foi realizada — ela é responsável pela troca ou reparo
            conforme a garantia legal (90 dias para vícios em produtos
            duráveis, conforme o CDC).
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-zinc-800 dark:text-zinc-100">
            Links de ofertas
          </h2>
          <p>
            Trabalhamos para manter os preços e links atualizados, mas eles são
            informados pelas lojas parceiras e podem sofrer alterações sem
            aviso. Sempre confira o preço final e as condições na página da
            loja antes de concluir a compra.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-zinc-800 dark:text-zinc-100">
            Dúvidas
          </h2>
          <p>
            Para questões sobre pedidos, pagamentos ou devoluções, fale
            diretamente com a loja vendedora. Para dúvidas sobre o funcionamento
            do {SITE_NAME}, entre em contato pelos nossos canais oficiais.
          </p>
        </section>
      </div>

      <p className="mt-8 text-xs text-zinc-400">
        Ver também: <Link href="/politica-de-privacidade" className="font-semibold text-emerald-600 hover:underline">Política de Privacidade</Link>
      </p>
    </div>
  );
}
