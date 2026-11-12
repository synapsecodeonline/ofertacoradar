// Categorias canonicas do site (slugs em pt-BR).
// Ofertas da Lomadee chegam com slugs tipo "home-and-decoration";
// produtos do catalogo chegam com "womens_clothing"; e muitos itens
// nao tem categoria — nesses casos classificamos pelo titulo.

export const CATEGORY_LABEL: Record<string, string> = {
  "moda-feminina": "Moda Feminina",
  "moda-masculina": "Moda Masculina",
  "moda-infantil": "Moda Infantil",
  calcados: "Calçados",
  "bolsas-acessorios": "Bolsas e Acessórios",
  "joias-relogios": "Joias e Relógios",
  beleza: "Beleza",
  perfumaria: "Perfumaria",
  saude: "Saúde e Bem-estar",
  "casa-decoracao": "Casa e Decoração",
  moveis: "Móveis",
  cozinha: "Cozinha",
  eletrodomesticos: "Eletrodomésticos",
  eletronicos: "Eletrônicos",
  celulares: "Celulares",
  informatica: "Informática",
  games: "Games",
  brinquedos: "Brinquedos",
  pets: "Pets",
  automotivo: "Automotivo",
  supermercado: "Supermercado",
  "alimentos-bebidas": "Alimentos e Bebidas",
  "esporte-lazer": "Esportes e Lazer",
  ferramentas: "Ferramentas",
  construcao: "Construção",
  jardim: "Jardim e Piscina",
  viagem: "Viagens",
  eventos: "Ingressos e Eventos",
  software: "Software",
  papelaria: "Papelaria",
  servicos: "Serviços",
  industria: "Indústria",
  ofertas: "Ofertas",
  outros: "Outros",
};

// Ordem de exibicao na navegacao (mais populares primeiro)
export const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL);

// Alias: qualquer slug de origem -> categoria canonica
const ALIAS: Record<string, string> = {
  // --- estilo Lomadee campaigns (hifen) ---
  "home-and-decoration": "casa-decoracao",
  "home-appliances": "eletrodomesticos",
  electronics: "eletronicos",
  "cell-phones": "celulares",
  computers: "informatica",
  fashion: "ofertas",
  "women-clothing": "moda-feminina",
  "men-clothing": "moda-masculina",
  "women-fashion": "moda-feminina",
  "men-fashion": "moda-masculina",
  shoes: "calcados",
  bags: "bolsas-acessorios",
  jewelry: "joias-relogios",
  beauty: "beleza",
  "health-and-personal-care": "saude",
  "sports-and-leisure": "esporte-lazer",
  toys: "brinquedos",
  "baby-and-kids": "moda-infantil",
  "baby-products": "moda-infantil",
  "infant-products": "moda-infantil",
  "kids-products": "moda-infantil",
  pets: "pets",
  animals: "pets",
  automotive: "automotivo",
  "auto-and-accessories": "automotivo",
  books: "outros",
  "books-and-literature": "outros",
  games: "games",
  supermarket: "supermercado",
  "food-and-beverages": "alimentos-bebidas",
  stationery: "papelaria",
  "industry-and-commerce": "industria",
  services: "servicos",
  travel: "viagem",
  "tourism-and-leisure": "viagem",
  "tickets-and-events": "eventos",
  software: "software",
  "cell-phone-accessories": "celulares",
  tv: "eletronicos",
  "tv-and-audio": "eletronicos",
  cameras: "eletronicos",
  instruments: "outros",
  tools: "ferramentas",
  construction: "construcao",
  "renovation-construction": "construcao",
  garden: "jardim",
  kitchen: "cozinha",
  furniture: "moveis",
  sports: "esporte-lazer",
  shopping: "ofertas",
  promotions: "ofertas",
  wellness: "saude",
  health: "saude",
  "art-and-culture": "outros",
  "beauty-and-fashion": "beleza",
  "home-decor": "casa-decoracao",
  "home-decoration": "casa-decoracao",
  "fashion-accessories": "bolsas-acessorios",
  "bags-and-accessories": "bolsas-acessorios",
  "women-accessories": "bolsas-acessorios",
  // --- estilo catalogo Lomadee products (underscore) ---
  womens_clothing: "moda-feminina",
  mens_clothing: "moda-masculina",
  kids_clothing: "moda-infantil",
  baby_clothing: "moda-infantil",
  bags_accessories: "bolsas-acessorios",
  fashion_accessories: "bolsas-acessorios",
  decor_items: "casa-decoracao",
  home_decor: "casa-decoracao",
  home_utilities: "casa-decoracao",
  perfumes: "perfumaria",
  cosmetics: "beleza",
  technology_digital: "informatica",
  electronics_technology: "eletronicos",
  sports_leisure: "esporte-lazer",
  camping_adventure: "esporte-lazer",
  parts_accessories: "automotivo",
  vehicles_autoparts: "automotivo",
  cultivation: "jardim",
  gardening: "jardim",
  commerce_retail: "ofertas",
  industry_production: "industria",
  industrial_chemicals: "industria",
  hardware: "ferramentas",
  carpentry: "construcao",
  others: "outros",
};

// Classificador por palavras-chave do titulo (pt-BR), usado quando
// a fonte nao informa categoria. Ordem importa: primeiro match vence.
const KEYWORDS: [RegExp, string][] = [
  [/\b(celular|smartphone|iphone|galaxy|xiaomi|motorola|fone de ouvido|airpods|smartwatch)\b/i, "celulares"],
  [/\b(notebook|laptop|pc gamer|computador|monitor|teclado|mouse|ssd|hd externo|processador|placa de v[ií]deo|gabinete)\b/i, "informatica"],
  [/\b(tv|televis[aã]o|soundbar|home theater|caixa de som|fone bluetooth|smart tv)\b/i, "eletronicos"],
  [/\b(fog[aã]o|geladeira|freezer|micro-ondas|airfryer|air fryer|liquidificador|batedeira|cafeteira|lavadora|secadora|aspirador|purificador|umidificador|ventilador|ar condicionado|aquecedor|ferro de passar)\b/i, "eletrodomesticos"],
  [/\b(air fryer|fritadeira el[eé]trica|cooktop|forno el[eé]trico|expositor|balan[cç]a)\b/i, "cozinha"],
  [/\b(sof[aá]|poltrona|mesa de jantar|cama|colch[aã]o|guarda-roupa|arm[aá]rio|cômoda|cama box|estante|rack|painel para tv|escrivaninha)\b/i, "moveis"],
  [/\b(espelho|quadro|lumin[aá]ria|l[aâ]mpada|cortina|tapete|almofada|jogo de cama|toalha|organizador|vase|vaso|decorativo|decorac[aã]o|candlestick|terr[aá]rio)\b/i, "casa-decoracao"],
  [/\b(panela|jogo de panelas|frigideira|assadeira|forma de bolo|utens[ií]lio|talher|jogo americano|garrafa t[eé]rmica|pote herm[eé]tico|lixeira|dispensador|escorredor|tabua de corte|churrasqueira)\b/i, "cozinha"],
  [/\b(vestido|blusa|cal[cç]a|saia|shorts|conjunto|body|camiseta|cropped|regata|blazer|jaqueta|cardig[aã]|casaco|tricot|macaquinho|jardineira)\b/i, "moda-feminina"],
  [/\b(camiseta masculina|cal[cç]a jeans masculina|bermuda|cueca|camisa polo|chap[eé]u|bon[eé])\b/i, "moda-masculina"],
  [/\b(roupa infantil|roupa de beb[eê]|body bebe|conjunto infantil|pijama infantil|fralda|mamadeira|chupeta|ber[cç]ario|carrinho de beb[eê]|mochila escolar|uniforme escolar)\b/i, "moda-infantil"],
  [/\b(t[eê]nis|sapato|sand[aá]lia|rasteirinha|botina|bota|scarpin|chinelo|mocassim|papete|sapatilha|rasteira)\b/i, "calcados"],
  [/\b(bolsa|mochila|carteira|necessaire|pochete|clutch|ri[nñ]onera|pasta executiva)\b/i, "bolsas-acessorios"],
  [/\b([óo]culos|rel[oó]gio|pulseira|brinco|colar|anel|piercing|tiara|correia)\b/i, "joias-relogios"],
  [/\b(perfume|colon[\s]?ie|eau de|fragr[âa]ncia|desodorante|body splash)\b/i, "perfumaria"],
  [/\b(maquiagem|batom|base|r[ií]mel|delineador|esmalte|esfoliante|m[aá]scara de c[ií]lios|skincare|sabonete facial|[aá]cido hialur[oô]nico|vitamina c|serum|[aá]gua micelar|protetor solar|hidratante|condicionador|shampoo|finalizador|progressiva|escova modeladora)\b/i, "beleza"],
  [/\b(rem[eé]dio|medicamento|vitamina|suplemento|protetor|term[oô]metro|glicos[ií]metro|aparelho de press[aã]o|teste de gravidez|antibi[oó]tico|anti-inflamat[oó]rio|dorflex|dor de cabeça)\b/i, "saude"],
  [/\b(cachorro|gato|pet|racao|petisco para pet|areia para gato|coleira|tosa|veterin[aá]rio|aqu[aá]rio|passeio para c[aã]o)\b/i, "pets"],
  [/\b(pneu|oleo|oleo de motor|bateria automotiva|pastilha de freio|amortecedor|farol|parachoque|central multim[ií]dia automotiva|banco de couro|tapete automotivo|limpa para-brisa)\b/i, "automotivo"],
  [/\b(cerveja|vinho|whisky|vodka|gin|energ[eé]tico|refrigerante|suco|[aá]gua|caf[eé]|ch[aá]|cerveja artesanal|kit churrasco|vinho tinto|espumante)\b/i, "alimentos-bebidas"],
  [/\b(arroz|feij[aã]o|a[cç][uú]car|sal|azeite|[oó]leo|massa|biscoito|cerveja|leite|detergente|sab[aã]o em p[oó]|[aá]gua sanit[aá]ria|papel higi[eê]nico|alvejante|desinfetante)\b/i, "supermercado"],
  [/\b(bola|halteres|el[aá]stico|esteira|bicicleta|patins|skate|raquete|rede de volei|bola de futebol|yoga|pilates|caneleira|luva de boxe|natação)\b/i, "esporte-lazer"],
  [/\b(lego|boneco|action figure|barbie|hot wheels|jogo de tabuleiro|quebra-cabe[cç]a|carrinho de controle remoto|brinquedo|pel[úu]cia)\b/i, "brinquedos"],
  [/\b(furadeira|parafusadeira|serra|chave de fenda|trena|n[ií]vel|betoneira|compressor|solda|ferramenta|jogo de chaves|alicate|martelo)\b/i, "ferramentas"],
  [/\b(tinta|pincel|rolo de pintura|massa corrida|selador|impermeabilizante|cimento|argamassa|telha|tijolo|drywall|gesso|verniz|resina ep[oó]xi)\b/i, "construcao"],
  [/\b(planta|vaso de planta|terra vegetal|semente|regador|mangueira|grama|adubo|rede de descanso|rede de dormir|cortador de grama|piscina)\b/i, "jardim"],
  [/\b(mala de viagem|mochila de viagem|mala de m[aã]o|bagagem|necessaire de viagem|passagem a[eé]rea|passagem aerea|hotel|pacote de viagem|resort|pousada|airbnb|cruzeiro)\b/i, "viagem"],
  [/\b(ingresso para show|show|festival|teatro|cinema|ingresso|ingressos|evento|evento online|congresso|workshop|stand up|com[eé]dia)\b/i, "eventos"],
  [/\b(software|aplicativo|licen[cç]a|assinatura|plano|curso online|e-book|livro digital|template|wordpress|windows|office 365|antiv[ií]rus|vpn)\b/i, "software"],
  [/\b(caderno|caneta|marca-texto|estojo|mochila escolar|agenda|planner|papelaria|post-it|apontador)\b/i, "papelaria"],
  [/\b(instrumento musical|viol[aã]o|guitarra|teclado musical|microfone|caixa de som|mesa de som|interface de [aá]udio)\b/i, "eletronicos"],
  [/\b(ind[uú]stria|equipamento industrial|m[aá]quina industrial|componente eletr[oô]nico|placa de circuito|sensor|motor el[eé]trico)\b/i, "industria"],
];

const norm = (s: string) => s.trim().toLowerCase().replace(/_/g, "-");

// Resolve uma categoria de origem para a canonica; se desconhecida,
// tenta classificar pelo titulo; fallback "outros".
export function resolveCategory(raw: string | undefined | null, title?: string): string {
  if (raw) {
    const key = norm(raw);
    if (ALIAS[key]) return ALIAS[key];
    if (CATEGORY_LABEL[key]) return key;
  }
  if (title) {
    for (const [re, slug] of KEYWORDS) {
      if (re.test(title)) return slug;
    }
  }
  return raw && CATEGORY_LABEL[norm(raw)] ? norm(raw) : "outros";
}

// Slug canonico de um valor de categoria (qualquer formato de origem)
export function canonicalCategory(raw: string | null | undefined): string {
  return resolveCategory(raw ?? undefined);
}

// Todos os valores brutos que representam uma categoria canonica
// (canonico + slugs de origem mapeados), para filtros no banco
export function rawSlugsFor(canonical: string): string[] {
  const raws = [canonical];
  for (const [k, v] of Object.entries(ALIAS)) {
    if (v === canonical && !raws.includes(k)) raws.push(k);
  }
  return raws;
}

// Atalho para quando so temos o titulo (itens sem categoria na fonte)
export function categorizeByTitle(title: string): string {
  return resolveCategory(undefined, title);
}

export function categoryLabel(slug: string): string {
  const key = norm(slug);
  if (CATEGORY_LABEL[key]) return CATEGORY_LABEL[key];
  // valores legados (ex.: "womens_clothing") -> rotulo da canonica
  const aliased = ALIAS[key];
  if (aliased && CATEGORY_LABEL[aliased]) return CATEGORY_LABEL[aliased];
  return slug
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
