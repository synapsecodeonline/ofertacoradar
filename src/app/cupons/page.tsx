import { redirect } from "next/navigation";

// A pagina /cupons virou a aba Cupons da home — redirect preserva
// links antigos e o valor de SEO ja indexado.
export default function CuponsPage() {
  redirect("/?aba=cupons");
}
