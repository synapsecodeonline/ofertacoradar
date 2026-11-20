// Lojas em destaque na home. `merchant` precisa bater com Product.merchant
// (filtro ?loja=); `brand` e o nome usado para achar o logo na tabela Brand;
// `domain` e fallback de logo via favicon quando nao ha Brand.
export interface FeaturedStore {
  merchant: string;
  brand?: string;
  domain?: string;
}

export const FEATURED_STORES: FeaturedStore[] = [
  // selecionadas a pedido + maior volume/prova social do catalogo
  { merchant: "Mercado Livre", domain: "mercadolivre.com.br" },
  { merchant: "Amazon", domain: "amazon.com.br" },
  { merchant: "Malwee", brand: "Malwee", domain: "malwee.com.br" },
  { merchant: "Iodice", brand: "Iodice", domain: "iodice.com.br" },
  { merchant: "Coza", brand: "Coza", domain: "coza.com.br" },
  { merchant: "Amakha Paris", brand: "Amakha Paris", domain: "amakhaparis.com.br" },
  { merchant: "FATOR 5", brand: "FATOR 5", domain: "fator5.com.br" },
  { merchant: "Brinox", brand: "Brinox", domain: "brinox.com.br" },
  { merchant: "Autoamerica Store", brand: "Autoamerica Store", domain: "autoamericastore.com.br" },
  { merchant: "AmoKarité", brand: "AmoKarité", domain: "amokarite.com.br" },
  { merchant: "Morena Rosa", brand: "Morena Rosa", domain: "morenarosa.com.br" },
  { merchant: "Multimóveis", brand: "Multimóveis", domain: "multimoveis.com" },
  { merchant: "ECO FLAME GARDEN", brand: "ECO FLAME GARDEN", domain: "ecoflamegarden.com.br" },
  { merchant: "Mundo Vem", brand: "Mundo Vem", domain: "mundovem.com.br" },
  { merchant: "Dona Coelha", brand: "Dona Coelha", domain: "donacoelha.com" },
  { merchant: "Móveis Carraro", brand: "Móveis Carraro", domain: "carraro.com.br" },
  { merchant: "Rovitex", brand: "Rovitex", domain: "rovitex.com.br" },
  { merchant: "UP Kids", brand: "UP Kids", domain: "upkids.com.br" },
  { merchant: "Anhanguera Ferramentas", brand: "Anhanguera Ferramentas" },
  { merchant: "Lojão dos Esportes", brand: "Lojão dos Esportes", domain: "lojaodosesportes.com.br" },
  { merchant: "Soulier", brand: "Soulier", domain: "soulier.com.br" },
  { merchant: "Moto BR", brand: "Moto BR" },
  { merchant: "Lauri Esporte", brand: "Lauri Esporte", domain: "lauriesporte.com.br" },
  { merchant: "Shopee", brand: "Shopee" },
  { merchant: "Sofá na Caixa", brand: "Sofá na Caixa", domain: "sofanacaixa.com.br" },
];

export function storeLogo(
  store: FeaturedStore,
  brandLogoByName: Map<string, string | null>,
): string | null {
  const needle = (store.brand ?? store.merchant).toLowerCase();
  for (const [name, logo] of brandLogoByName) {
    const n = name.toLowerCase();
    if (n === needle || n.includes(needle) || needle.includes(n)) {
      if (logo) return logo;
    }
  }
  if (store.domain) {
    return `https://www.google.com/s2/favicons?domain=${store.domain}&sz=128`;
  }
  return null;
}
