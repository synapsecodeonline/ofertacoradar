// Categorias canonicas do site (slugs em pt-BR).
// Ofertas da Lomadee chegam com slugs tipo "home-and-decoration";
// produtos do catalogo chegam com "womens_clothing"; e muitos itens
// nao tem categoria — nesses casos classificamos pelo titulo.
// A taxonomia e granular: categorias filhas especificas primeiro,
// pais como fallback para o que sobrar.

export const CATEGORY_LABEL: Record<string, string> = {
  // --- Moda ---
  "moda-feminina": "Moda Feminina",
  vestidos: "Vestidos",
  calcas: "Calças e Saias",
  blusas: "Blusas e Jaquetas",
  "moda-praia": "Moda Praia",
  lingerie: "Lingerie e Pijamas",
  "moda-masculina": "Moda Masculina",
  "moda-infantil": "Moda Infantil",
  "calcados-infantil": "Calçados Infantil",
  "moda-praia-infantil": "Moda Praia Infantil",
  bebe: "Bebê e Fraldas",
  calcados: "Calçados",
  "bolsas-mochilas": "Bolsas e Mochilas",
  "acessorios-moda": "Acessórios",
  oculos: "Óculos",
  "joias-relogios": "Joias e Relógios",
  // --- Beleza e saude ---
  beleza: "Beleza",
  "beleza-infantil": "Beleza Infantil",
  maquiagem: "Maquiagem",
  cabelo: "Cabelo e Finalizadores",
  skincare: "Skincare",
  perfumaria: "Perfumaria",
  saude: "Saúde e Bem-estar",
  suplementos: "Suplementos",
  // --- Casa ---
  "casa-decoracao": "Casa e Decoração",
  decoracao: "Decoração",
  iluminacao: "Iluminação",
  "textil-cama": "Têxtil e Cama",
  organizacao: "Organização",
  moveis: "Móveis",
  cozinha: "Cozinha",
  "eletrodomesticos": "Eletrodomésticos",
  climatizacao: "Climatização",
  "eletro-cocina": "Eletro de Cozinha",
  "eletro-limpeza": "Eletro de Limpeza",
  // --- Tecnologia ---
  eletronicos: "Eletrônicos",
  "eletronicos-infantil": "Eletrônicos Infantil",
  "tv-audio": "TVs e Áudio",
  fotografia: "Fotografia e Câmeras",
  informatica: "Informática",
  celulares: "Celulares",
  games: "Games",
  software: "Software",
  // --- Esportes ---
  "esporte-lazer": "Esportes e Lazer",
  "esporte-infantil": "Esporte Infantil",
  fitness: "Fitness e Academia",
  ciclismo: "Ciclismo",
  camping: "Camping e Trilhas",
  // --- Auto e industrial ---
  automotivo: "Automotivo",
  "pecas-veiculos": "Peças e Acessórios Auto",
  ferramentas: "Ferramentas",
  "tinta-pintura": "Tinta e Pintura",
  construcao: "Construção",
  "fixacao-metalica": "Fixação e Metais",
  "quimica-industrial": "Química Industrial",
  eletrica: "Elétrica e Componentes",
  "bombas-motores": "Bombas e Motores",
  "medicao-precisao": "Medição e Precisão",
  jardim: "Jardim e Piscina",
  // --- Mercado ---
  supermercado: "Supermercado",
  mercearia: "Mercearia",
  "limpeza-higiene": "Limpeza e Higiene",
  "alimentos-bebidas": "Alimentos e Bebidas",
  pets: "Pets",
  // --- Outros ---
  brinquedos: "Brinquedos",
  papelaria: "Papelaria",
  viagem: "Viagens",
  eventos: "Ingressos e Eventos",
  servicos: "Serviços",
  industria: "Indústria",
  ofertas: "Ofertas",
  outros: "Outros",
};

// Ordem de exibicao na navegacao (mais populares primeiro)
export const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL);

// Alias: qualquer slug de origem -> categoria canonica
const norm = (s: string) => s.trim().toLowerCase().replace(/_/g, "-");

const ALIAS_RAW: Record<string, string> = {
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
  bags: "bolsas-mochilas",
  jewelry: "joias-relogios",
  beauty: "beleza",
  "health-and-personal-care": "saude",
  "sports-and-leisure": "esporte-lazer",
  toys: "brinquedos",
  "baby-and-kids": "moda-infantil",
  "baby-products": "bebe",
  "infant-products": "moda-infantil",
  "kids-products": "moda-infantil",
  pets: "pets",
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
  tv: "tv-audio",
  "tv-and-audio": "tv-audio",
  cameras: "fotografia",
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
  "fashion-accessories": "acessorios-moda",
  "bags-and-accessories": "bolsas-mochilas",
  "women-accessories": "acessorios-moda",
  // --- estilo catalogo Lomadee products (underscore) ---
  womens_clothing: "moda-feminina",
  mens_clothing: "moda-masculina",
  kids_clothing: "moda-infantil",
  baby_clothing: "moda-infantil",
  bags_accessories: "bolsas-mochilas",
  fashion_accessories: "acessorios-moda",
  decor_items: "decoracao",
  home_decor: "casa-decoracao",
  home_utilities: "casa-decoracao",
  perfumes: "perfumaria",
  cosmetics: "maquiagem",
  technology_digital: "informatica",
  electronics_technology: "eletronicos",
  sports_leisure: "esporte-lazer",
  camping_adventure: "camping",
  parts_accessories: "pecas-veiculos",
  vehicles_autoparts: "pecas-veiculos",
  cultivation: "jardim",
  gardening: "jardim",
  commerce_retail: "ofertas",
  industry_production: "industria",
  industrial_chemicals: "quimica-industrial",
  hardware: "ferramentas",
  carpentry: "construcao",
  others: "outros",
  // --- valores legados do banco ---
  "bolsas-acessorios": "bolsas-mochilas",
  "bolsas_acessorios": "bolsas-mochilas",
};

const ALIAS: Record<string, string> = Object.fromEntries(
  Object.entries(ALIAS_RAW).map(([k, v]) => [norm(k), v]),
);

// Marcadores de público infantil (pt-BR) — usados pelas regras kidRe
const KID =
  "infantil|infantis|kids?|meninos?|meninas?|criancinhas?|criancas?|crian[cç]as?|juvenil|juvenis|adolescentes?|toddler|teens?|beb[eê]s?|baby";

// Casa quando o título tem marcador infantil E termo de produto
// (em qualquer ordem, até 60 chars de distância).
const kidRe = (prod: string) =>
  new RegExp(
    `\\b(?:${KID})\\b[\\s\\S]{0,60}\\b(?:${prod})\\b|\\b(?:${prod})\\b[\\s\\S]{0,60}\\b(?:${KID})\\b`,
    "i",
  );

// Classificador por palavras-chave do titulo (pt-BR).
// ORDEM IMPORTA: primeiro match vence — categorias filhas especificas
// vem antes dos pais genericos.
const KEYWORDS: [RegExp, string][] = [
  // ===== Infantil (prioridade máxima: separa do adulto) =====
  [kidRe("esporte|esportes|futebol|v[oô]lei|v[oô]leis|basquete|handebol|bola|bolas|bicicleta|bicicletas|bike|bikes|patins|patinete|patinetes|hoverboard|monociclo|raquete|raquetes|capacete|capacetes|trenzinho|trenzinhos|t[eê]nis de mesa|ping.?pong|longboard|penny|casco|cascos"), "esporte-infantil"],
  [kidRe("calcado|calcados|sand[aá]lia|sand[aá]lias|t[eê]nis|sapato|sapatos|bota|botas|chinelo|chinelos|papete|papetes|sapatilha|sapatilhas|rasteirinha|rasteirinhas|sapatenis|sapat[eê]nis|tamanco|tamancos|galocha|galochas|scarpin|scarpins|salto|saltos|mocassim|mocassins|loafer|loafers|sneaker|sneakers|slipper|slippers|coturno|coturnos"), "calcados-infantil"],
  [kidRe("biqu[ií]ni|biqu[ií]nis|sunga|sungas|cavada|cavadas|mai[oô]|sa[ií]da de praia|canga|cangas|moda praia|praia|pool|piscina|biquini|biquinis"), "moda-praia-infantil"],
  [kidRe("shampoo|xampu|condicionador|sabonete|sabonetes|creme|cremes|hidratante|hidratantes|protetor solar|repelente|repelentes|pomada|pomadas|len[cç]o umedecido|lencos umedecidos|higiene|higi[eê]nico|higienico|higi[eê]nicos|higienicos|wipes|perfume|perfumes|colonia|colonias|desodorante|desodorantes|protetor labial|protetor facial|higiene bucal|escova de dente|fio dental"), "beleza-infantil"],
  [kidRe("celular|celulares|smartphone|smartphones|tablet|tablets|smartwatch|smartwatches|fone|headset|console|consoles|videogame|video game|videogames|camera|cameras|drone|drones|eletronico|eletrônico|eletronicos|eletrônicos|notebook|notebooks|computador|computadores|tv|televisao|televisão|televisores|radio|rádio|radios|rádios|caixa de som|microfone|microfones|carregador|carregadores|cabo|cabos|fone bluetooth|smart tv|soundbar|home theater|projetor|projetores"), "eletronicos-infantil"],
  [kidRe("vestido|vestidos|cal[cç]a|cal[cç]as|saia|saias|blusa|blusas|camisa|camisas|camiseta|camisetas|regata|regatas|moletom|moletoms|hoodie|hoodies|conjunto|conjuntos|pijama|pijamas|macac[aã]o|macac[aã]ões|jardineira|jardineiras|shorts|bermuda|bermudas|body|bodies|tricot|tricots|cardigan|cardigans|jaqueta|jaquetas|casaco|casacos|colete|coletes|tunica|túnica|t[uú]nicas|blusao|blusão|blusões|sutia|sutiã|sutiãs|calcinha|calcinhas|cueca|cuecas|look|looks|outfit|outfits|moda|fashion|estampad|listrad|roupa|roupas|vestuario|vestuário|confec|camisola|camisolas|negligee|macacaozinho|cropped|sueter|suéter|blus[aã]o"), "moda-infantil"],

  // ===== Auto / peças de veículos =====
  [/\b(bagageiro|ba[uú]\s*(lateral|traseiro|givi|shad|monolock|top.?case|motocicleta)|ba[uú]leto|bauleto|alforje|top.?case|mala para moto|quebra vento|protetor de (motor|tanque|carenagem|quadro)|capa de moto|hitch|engate.{0,25}(reboque|trailer|carro|moto|implemento|carreta)|reboque|macaco|tri[aâ]ngulo|estepe|calota|aba (de )?tanque|protetor de tanque)\b/i, "pecas-veiculos"],
  [/\b(pneu|rodado|amortecedor|pastilha de freio|disco de freio|pin[aâ]o|coroa|catraca|kit transmiss[aã]o|embreagem|embreagem kit|kitembreagem|c[aâ]mbio|cambio|bomba de combust[ií]vel|bomba combust[ií]vel|bomba [aá]gua|vela de igni[cç][aã]o|bico injetor|correia dentada|correia|tensionador|sonda lambda|sensor de oxig[eê]nio|coxim|suporte de motor|ponta de eixo|cardan|semieixo|semi.?eixo|homocin[eé]tica|piv[oô]|coletor|escapamento|silenciador|reservat[oó]rio|reservatorio|bobina de igni[cç][aã]o|bobina igni[cç][aã]o|carretel|estator|[ií]m[aã]s?|aro (de )?roda|aro roda|roda (de|para) (carro|moto|caminh[aã]o|onibus)|bomba de (pneu|ar de pneu|bicicleta))\b/i, "pecas-veiculos"],
  [/\b(parachoque|farol|lanterna|retrovisor|radiador|comando de acelerador|pedal (de|do) (acelerador|freio|embreagem)|bandeja de suspens[aã]o|cubo de roda|capa de banco|banco de couro|capa de volante|volante|multim[ií]dia automotiva|central multim[ií]dia|tela multim[ií]dia|som automotiva|tapete automotivo|c[aâ]mera de r[eé]|camera de re)\b/i, "pecas-veiculos"],
  [/\b(filtro de (ar|[oó]leo|combust[ií]vel|cabine)|bateria (automotiva|de moto|para moto|moura|heliar|willard|energit|aze|nok|yuasa|motobatt|shoto)|pecas? (para|de|auto)|autope[cç]as|motope[cç]as|pe[cç]as veiculares|ofertas? pneus?|pneu de caminh[aã]o|pneu moto|automotivo|auto pe[cç]as|carro|autom[oó]vel|ve[ií]culo)\b/i, "pecas-veiculos"],
  [/\b(automotivo|auto pe[cç]as|carro|autom[oó]vel|ve[ií]culo|motor de carro|motor de moto|motor para|motor [0-9])\b/i, "automotivo"],

  // ===== Celulares / acessórios =====
  [/\b(celular|smartphone|iphone|galaxy|xiaomi|motorola|redmi|poco|realme|fone de ouvido|airpods|smartwatch|smart band|mi band|fone bluetooth|fone sem fio|headset bluetooth|fone in-ear|fone earbud|fone tws|fone wireless|fone usb|fone p2|fone lightning|fone adaptador|fone splitter|bateria externa|power ?bank|powerbank)\b/i, "celulares"],
  [/\b(monitor (fetal|de press[aã]o|card[ií]aco|de frequ[eê]ncia|de glicose|de batimentos)|ox[ií]metro|pulseira (de press[aã]o|card[ií]aca|de frequ[eê]ncia))\b/i, "saude"],

  // ===== Tecnologia =====
  [/\b(smart tv|televis[aã]o|\btv\b|soundbar|home theater|caixa de som|caixinha de som|projetor|receiver|amplificador|[aá]udio|som automotivo|r[aá]dio|auto r[aá]dio|equalizador|turntable|vitrola|reproductor de m[uú]sica)\b/i, "tv-audio"],
  [/\b(c[aâ]mera|camera|gopro|filmadora|lente|drone|stabilizador|trip[eé]|monop[eé]|carregador de c[aâ]mera|bolsa de c[aâ]mera|selfie stick|gimbal|microfone de lapela|microfone shotgun|microfone condenser)\b/i, "fotografia"],
  [/\b(notebook|laptop|pc gamer|computador|monitor|teclado|mouse|ssd|hd externo|processador|placa de v[ií]deo|placa de som|placa de rede|placa de captura|placa m[aã]e|gabinete|all in one|macbook|chromebook|nobreak|no break|fonte atx|fonte 80 plus|cooler|water cooler|tablet|ipad|surface|perif[eé]ricos|webcam|headset|fone gamer|teclado mec[aâ]nico|mouse gamer|mouse sem fio|mouse bluetooth|monitor gamer|mem[oó]ria (ram|ddr)|placa de som|placa de rede)\b/i, "informatica"],
  [/\b(playstation|ps[45]|xbox|nintendo|switch|steam|jogo (ps|xbox|nintendo|de videogame|de console)|videogame|video game|controle (ps|xbox|nintendo|dualshock|dualsense|sem fio|bluetooth|usb|gamer|wireless|de videogame|de console|ps4|ps5)|joy-?con|dualshock|dualsense|cadeira gamer|mesa gamer|streaming|stream deck|capture card|elgato)\b/i, "games"],
  [/\b(software|aplicativo|licen[cç]a|assinatura|plano|curso online|e-book|livro digital|template|wordpress|windows|office 365|antiv[ií]rus|vpn|adobe|photoshop|illustrator|premiere|after effects|lightroom|indesign|autocad|solidworks|revit|sketchup|blender|cinema 4d|stock)\b/i, "software"],
  [/\b(jogo de bingo|bingo|ludo|domin[oó]|domino|baralho|uno\b|trivial|impostor|catan|jogo de tabuleiro|jogos de tabuleiro|roleta|action figure|boneco|barbie|hot wheels|lego|playmobil|nerf|slime|massinha|brinquedo educativo|puzzle|rompecabezas|imaginext|baby alive|lol surprise|pokemon|yu-gi-oh|trading card|figura de a[cç][aã]o|funko|pop vinyl|bobblehead|chaveiro|quebra-cabe[cç]a|jogo de tabuleiro|brinquedo|pel[uú]cia)\b/i, "brinquedos"],

  // ===== Papelaria (cedo: mochila/estojo escolar etc.) =====
  [/\b(caderno|caneta|marca-texto|estojo|mochila escolar|lancheira escolar|agenda|planner|papelaria|bloco (de )?desenho|bloco (de )?anota[cç][oõ]es|caderno (de )?desenho|caderno (de )?anota[cç][oõ]es|bloco (de )?rascunho|papel sulfite|papel offset|papel cartaz|papel pardo|papel seda|papel verg[eê]|papel manga|papel kraft|post-it|apontador|livro|livros|romance|biografia|autobiografia)\b/i, "papelaria"],

  // ===== Natal/decoração sazonal (antes de química: "resina" conflita) =====
  [/\b(arvore[^.\n]{0,40}natal|natal[^.\n]{0,40}arvore|árvore[^.\n]{0,40}natal|pres[ée]pio)\b/i, "decoracao"],

  // ===== Química / fixação (cedo: termos específicos que aparecem em títulos de casa) =====
  [/\b(forma|assadeira|molde|esp[aá]tula|p[aá]|luva|tapete|escorredor|porta|copo|tigela|bowl|caneca|pote|frasco|recipiente) de silicone\b/i, "cozinha"],
  [/\b(adesivo|selante|resina|ep[oó]xi|loctite|silicone|cola|vedacit|desengripante|removedor|thinner|lubrificante|graxa|[oó]leo lubrificante|[oó]leo mineral|[oó]leo sintético|[oó]leo vegetal|[oó]leo de corte|anel de veda[cç][aã]o|vedante|gaxeta)\b/i, "quimica-industrial"],
  [/\b(parafuso|porca|arruela|rebite|grampo|abra[cç]adeira|barra roscada|chumbador|pino|trava|bucha|cavilha|espiral|tirante|parafuso sextavado|porca sextada|flange|pino cônico|pino c[oô]nico|pino paralelo|pino el[aá]stico|pino r[ií]gido|pino de press[aã]o|pino de reten[cç][aã]o|anel de reten[cç][aã]o|anilha|arruela de press[aã]o|arruela lisa|arruela dentada|arruela grower|arruela de segurança|arruela de pressão|bloco padr[aã]o|bloco de a[cç]o|bloco em a[cç]o|arame|arame farpado|bloco em v|bloco magn[eé]tico)\b/i, "fixacao-metalica"],

  // ===== Bateria por contexto (antes do fallback veicular) =====
  [/\bbateria (externa|port[aá]til|solar|estacion[aá]ria|lifepo|de lit[ií]o|selada|para camping|de camping)\b/i, "camping"],
  [/\bbateria (de|para|do|da) (c[aâ]mera|camera|drone|gopro)\b/i, "fotografia"],
  [/\bbateria (de|para|do|da) (celular|smartphone|fone|headset|smartwatch|fone bluetooth)\b/i, "celulares"],
  [/\bbateria (de|para|do|da) (notebook|tablet|controle|console|video ?game|videogame|pc|computador)\b/i, "informatica"],
  [/\bbateria\b/i, "pecas-veiculos"],

  // ===== Promoções puras (banners) =====
  [/\b(flash sale|% ?off|off em todo|tudo com at[eé]|liquida[cç][aã]o|queima de estoque|black friday|cyber monday|oferta rel[aâ]mpago|oferta do dia|promo[cç][aã]o rel[aâ]mpago|dia do cliente|dia das m[aã]es|dia dos pais|dia dos namorados|leve mais pague menos|novidade!|_lomadee|network_lomadee|\bbanner\b|cole[cç][aã]o (de|nova)|at[eé] \d{1,2}%)\b/i, "ofertas"],

  // ===== Moda =====
  [/\b(t[eê]nis de mesa|ping.?pong)\b/i, "esporte-lazer"],
  [/\b(biqu[ií]ni|biquini|mai[oô]|sunga|cavada|canga|pare[oô]|sa[ií]da de praia|moda praia)\b/i, "moda-praia"],
  [/\b(vestido|vestidos)\b/i, "vestidos"],
  [/\b(cal[cç]a|pantalona|legging|saia|shorts|bermuda|macac[aã]o|jardineira|culotte|bootcut|mom jeans|wide leg|cargo|saruel|jeans|denim|cal[cç]as|saias|bermudas)\b/i, "calcas"],
  [/\b(blusa|blus[aã]o|camisa|camiseta|regata|cropped|moletom|hoodie|su[eé]ter|cardigan|jaqueta|casaco|parka|blazer|tricot|polera|polerinha|t[uú]nica|tunica|colete|corta vento|canguru|body (manga|de|para|gestante|longo|curto|fitness|academia|dança|dan[aç]a)|top (cropped|b[aá]sico|fitness|academia|yoga)|conjunto (feminino|masculino|infantil|i?ntimo|de banho|de praia|de academia|de gin[aá]stica|de yoga|de pilates|de corrida|de ciclismo|de trilha|de camping|de festa|de casamento)|blusas|camisas|camisetas|regatas|moletoms|hoodies|su[eé]teres|cardigans|jaquetas|casacos|parkas|blazers|tricots|poleras|polerinhas|t[uú]nicas|coletes|corta ventos|cangurus)\b/i, "blusas"],
  [/\b(suti[aã]|calcinha|lingerie|pijama|pijamas|conjunto i?ntimo|corset|cueca|bermuda i?ntima|short lingerie|top lingerie|suti[aã]s|calcinhas|lingeries|corsets|cuecas)\b/i, "lingerie"],
  [/\b(t[eê]nis|sapato|sand[aá]lia|sapat[eê]nis|scarpin|salto|rasteira|chinelo|papete|mocassim|loafer|oxford|dockside|sapatilha|tamanco|bota|coturno|botina|galocha|slipper|rasteirinha|anabela|cal[cç]ado|calcado|t[eê]nises?|sapatos?|sand[aá]lias?|sapat[eê]nises?|scarpins?|saltos?|rasteiras?|chinelos?|papetes?|mocassins?|loafers?|oxfords?|dockside|sapatilhas?|tamancos?|botas?|coturnos?|botinas?|galochas?|slippers?|rasteirinhas?|cal[cç]ados?)\b/i, "calcados"],
  [/\b(bolsa|mochila|pasta executiva|carteira|necessaire|pochete|riñonera|rinonera|crossbody|tiracolo|bolsas|mochilas|carteiras|necessaires|pochetes|riñoneras|rinoneras|pastas executivas|crossbodys|tiracolos)\b/i, "bolsas-mochilas"],
  [/\b(joia|semi joia|semi-joia|rel[oó]gio|relogio|ter[cç]o|ros[aá]rio|amuleto|medalha|escapul[aá]rio|imagem religiosa|pingente|berloque|colar de ouro|brinco de ouro|anel de ouro|pulseira de ouro|joias|semi joias|rel[oó]gios|relogios|ter[cç]os|ros[aá]rios|amuletos|medalhas|escapul[aá]rios|pingentes|berloques)\b/i, "joias-relogios"],
  // Sinais fortes de bebê primeiro: "babador/bandana" não pode cair em acessórios de moda
  [/\b(babador|mamadeira|chupeta|fralda|fraldas|ber[cç]o|mois[eé]s|andador|sling|carrinho de beb[eê]|berço|bebe comfort|cercadinho|cercado|mamadeiras|chupetas|babadores|esterilizador|esterilizadora|tetina|bab[aá] eletr[oô]nica|bicos? anti-?c[oó]lica)\b/i, "bebe"],
  [/\b(brinco|colar|pulseira|anel|piercing|tiara|presilha|grampos|amarrador de cabelo|scrunchie|cinto|chap[eé]u|bones?\b|chapeu|riñonera|rinonera|tornozeleira|broche|bijuteria|adere[cç]o|adereco|acess[oó]rio|acessorio|brincos|colares|pulseiras|aneis|piercings|tiaras|presilhas|amarradores de cabelo|scrunchies|cintos|chap[eé]us|bones|chapeus|riñoneras|rinoneras|tornozeleiras|broches|bijuterias|adere[cç]os|aderecos|acess[oó]rios|acessorios|bon[eé]|bandana|gorro|meia|meias|len[cç]o|lenco|cachecol|viseira|headband)\b/i, "acessorios-moda"],
  [/\b([oó]culos|oculos|lente de contato|oculos de sol|oculos de grau|oculos escuros)\b/i, "oculos"],
  [/\b(frada\b|fralda|mamadeira|chupeta|ber[cç]o|mois[eé]s|sling|andador|bab[aá] eletr[oô]nica|baba eletronica|esterilizador|esterilizadora|bico anti-?c[oó]lica|tetina|babador|copo de transi[cç][aã]o|copo de transicao|prato infantil|talher infantil|absorvente|fraldas|mamadeiras|chupetas|ber[cç]os|mois[eé]s|slinks|andadores|bab[aá]s eletr[oô]nicas|babes eletronicas|esterilizadores|esterilizadoras|tetinas|babadores|copos de transi[cç][aã]o|copos de transicao|pratos infantis|talheres infantis|absorbentes)\b/i, "bebe"],
  [/\b(feminino|feminina|woman|women|mo[cç]a|senhora|senhorita|femininos|femininas)\b/i, "moda-feminina"],
  [/\b(masculino|masculina|masculin|homem|senhor|garoto|boy|masculinos|masculinas)\b/i, "moda-masculina"],
  [/\b(infantil|menino|menina|beb[eê]|kids|juvenil|crianca|crian[cç]a|adolescente|jovem|kid|toddler|teen|infantis|meninos|meninas|beb[eê]s|juvenis|criancas|crian[cç]as|adolescentes|jovens|toddlers|teens|bata|batas|roup[aã]o|roupao|macac[aã]ozinho|macacaozinho)\b/i, "moda-infantil"],
  [/\b(traje|look|outfit|moda|fashion|estampad[ao]|listrad[ao]|xadrez|floral|confec[cç][aã]o|confeccao|boutique|vestu[aá]rio|vestuario|roupa (feminina|masculina|infantil|de)|roupas)\b/i, "moda-feminina"],

  // ===== Beleza / saúde =====
  [/\b(mascara de c[ií]lios|cilios posticos|batom|base facial|r[ií]mel|delineador|sombra|blush|iluminador|corretivo|compacto|maquiagem|\bmake\b|kit maquiagem|kit make|esmalte|vidro de unhas|top coat|base coat|removedor de esmalte|gloss labial|balm labial|protetor labial|primer|fixador de maquiagem|setting spray|esponja de maquiagem|pincel de maquiagem|corretivo|contour|contorno|brow|sobrancelha|lash|extensor de c[ií]lios)\b/i, "maquiagem"],
  [/\b(shampoo|condicionador|m[aá]scara de hidrata[cç][aã]o|progressiva|cronograma capilar|finalizador|[oó]leo capilar|baby liss|chapinha|escova modeladora|escova de cabelo|modelador de cachos|prancha|modelador|botox capilar|hidratante capilar|creme para pentear|spray fixador|fixador de cabelo|leave in|serum capilar|pente|escova|touca de banho|len[cç]o|babyliss|touca|el[aá]stico de cabelo)\b/i, "cabelo"],
  [/\b(s[eé]rum|hidratante facial|protetor solar|[aá]cido hialur[oô]nico|vitamina c|[aá]gua micelar|esfoliante|sabonete facial|skincare|retinol|niacinamida|t[oô]nico facial|[aá]gua termal|toner|ess[eê]ncia facial|bb cream|cc cream|dermocosm[eé]tico|dermatol[oó]gico|[aá]cido salic[ií]lico|[aá]cido glic[oó]lico|peeling|m[aá]scara facial|sheet mask|sleeping mask|balsamo)\b/i, "skincare"],
  [/\b(perfume|colonia|eau de|fragr[aâ]ncia|desodorante|body splash|perfume masculino|perfume feminino|perfume importado|perfume nacional|perfume [aá]rabe|oud|[aá]mbar|vetiver|moschino|perfumaria|perfumeria)\b/i, "perfumaria"],
  [/\b(whey|creatina|glutamina|bcaa|suplemento|pr[eé]-treino|termog[eê]nico|multivitam[ií]nico|col[aá]geno|magn[eé]sio|zma|protein|prote[ií]na|hipercal[oó]rico|mass gainer|albumina|beta alanina|cafe[ií]na|melatonina|5-htp|dmha|vitaminas e minerais|massa muscular|hipertrofia|defini[cç][aã]o|emagrecimento|akkermat|controle do apetite|libido|desempenho sexual|pot[eê]ncia sexual)\b/i, "suplementos"],
  [/\b(rem[eé]dio|medicamento|vitamina|suplemento|protetor|term[oô]metro|glicos[ií]metro|aparelho de press[aã]o|teste de gravidez|antibi[oó]tico|anti-inflamat[oó]rio|dorflex|analg[eé]sico|anti-al[eé]rgico|anti-histam[ií]nico|antif[uú]ngico|antiss[eé]ptico|curativo|gaze|soro fisiol[oó]gico|compressa|banda|bandagem|abafador|protetor auricular|protetor de ouvido|equipamento de prote[cç][aã]o individual|\bepi\b)\b/i, "saude"],
  [/\b(maquiagem|batom|r[ií]mel|delineador|esmalte|esfoliante|m[aá]scara de c[ií]lios|skincare|sabonete facial|[aá]cido hialur[oô]nico|vitamina c|serum|[aá]gua micelar|protetor solar|hidratante|condicionador|shampoo|finalizador|progressiva|escova modeladora|\bspa\b|harmoniza[cç][aã]o|depila[cç][aã]o|est[eé]tica)\b/i, "beleza"],

  // ===== Casa / eletro =====
  [/\b(ar.?condicionado|ar condicionado|split|ventilador|torre de ventila|aquecedor|climatizador|purificador de ar|umidificador|desumidificador|exaustor|circulador de ar|frio port[aá]til)\b/i, "climatizacao"],
  [/\b(air ?fryer|airfryer|fritadeira el[eé]trica|liquidificador|batedeira|cafeteira|micro.?ondas|cooktop|forno el[eé]trico|forno de embutir|panela de press[aã]o el[eé]trica|panela el[eé]trica|sorveteira|processador de alimentos|grill|sanduicheira|m[aá]quina de caf[eé]|m[aá]quina de espresso|nespresso|torradeira|juicer|extrator de suco|pipoqueira|churrasqueira el[eé]trica|grelhador|galeteira|panificadora|m[aá]quina de macarr[aã]o|chocolateira)\b/i, "eletro-cocina"],
  [/\b(aspirador|lava.?lou[cç]as|ferro de passar|ferro el[eé]trico|lava roupas|m[aá]quina de lavar|secadora de roupas|mop el[eé]trico|vassoura el[eé]trica|aspirador rob[oô]|robo aspirador|escova el[eé]trica|cortador de grama|m[aá]quina de costura|overlock|m[aá]quina de bordar|seladora a v[aá]cuo|umidificador)\b/i, "eletro-limpeza"],
  [/\b(lumin[aá]rias?|l[aâ]mpadas?|lustres?|arandelas?|spots?|plafons?|abajures?|fitas? de led|refletores?|painel de led|lumin[aá]ria de mesa|lumin[aá]ria de piso|lumin[aá]ria de teto|kit led|perfil de led|sensor de presen[cç]a|interruptor com sensor|dimmer|varais?|varal de ch[aã]o|tendedouros?)\b/i, "iluminacao"],
  [/\b(jogo de cama|len[cç][oó]is?|fronhas?|travesseiros?|edredons?|cobertores?|mantas?|toalha de banho|toalhas?|tapetes?|cortinas?|persianas?|almofadas?|jogos? americanos?|guardanapos?|ta[cç]as?|copos?|canecas?|pires?|bule|leiteiras?|a[cç][uú]careras?|porta tempero|porta talheres|cestos?|capa de mesa|jogo de toalha|organizadora de cozinha|organizadoras de cozinha|porta guardanapo|portas? retrato|boleira|individual|americanas)\b/i, "textil-cama"],
  [/\b(organizador|organizadora|prateleira|nicho|cesto organizador|caixa organizadora|sapateira|closet|porta chaves|porta documentos|caixa de ferramentas|maleta de ferramentas|mala de ferramentas|estojo de ferramentas)\b/i, "organizacao"],
  [/\b(sof[aá]s?|poltronas?|mesas? de (jantar|centro|lateral)|cama box|colch[oõ]es?|guarda-roupas?|arm[aá]rios?|c[oô]modas?|estantes?|racks?|painel para tv|painel para televis[aã]o|escrivaninhas?|cadeiras?|cadeira de escrit[oó]rio|cadeira gamer|sof[aá] retr[aá]til|puffs?|banquetas?|bancos?|balc[aã]o|aparador(es)?|bufet|buf[eê]|criados? mudo|cabeceiras?|ber[cç]os?|bercos?|mois[eé]s|bebe comfort|balan[cç]os?|cadeira de balan[cç]o|redinhas?|playgrounds?|cercadinhos?|cercados?|tapetes? para beb[eê]|carrinhos? de beb[eê]|a[eé]reo de canto|mesa de canto|aereo de canto)\b/i, "moveis"],
  [/\b(quadros?|vasos? decorativos?|terr[aá]rios?|enfeites?|decora[cç][aã]o|decorativos?|candlesticks?|lousas?|espelhos? decorativos?|quadros? decorativos?|telas? decorativas?|sanfonados?|cordas?|sininhos? decorativos?|cestinhas?|cestos? decorativos?|suporte para plantas|cachep[oô]s?|arranjos? florais?|bico de papagaio|flores? artificiais?|galhos? decorativos?|pedras? decorativas?|portas? retrato|arvore de natal|árvore de natal|pres[ée]pios?|bandeiras?|banderinhas?|crisantemos?|rosas|girassois?|tulipas?|orqu[ií]deas?|astromelias?|margaridas?|cravos?|jasmim|lavandas?|hort[eê]nsias?|pe[oô]nias?|d[áa]lias?|l[ií]rios?|costela de ad[aã]o|suculentas?|cactos? artificiais?|painel decorativo|quadro decorativo)\b/i, "decoracao"],
  [/\b(sof[aá] cama|cama box casal|cama box solteiro|cama casal|cama solteiro|beliche|bicama|solteiro|casal)\b/i, "moveis"],
  [/\b(mesa de cabeceira|criado mudo|balc[aã]o bar|home bar|balc[aã]o cozinha|ilha|cozinha planejada|gabinete cozinha|arm[aá]rio cozinha)\b/i, "cozinha"],
  [/\b(panelas?|jogo de panelas|frigideiras?|assadeiras?|forma de bolo|utens[ií]lios?|talheres?|jogos? americanos?|garrafa t[eé]rmica|potes? herm[eé]ticos?|lixeiras?|dispensadores?|escorredores?|t[aá]buas? de corte|churrasqueiras?|descascadores?|rala queijos?|espremedores?|facas?|jogo de facas|tabuas?|t[aá]buas?|potes?|recipientes?|marmitas?|lancheiras?|garrafas?|squeezes?|canudos?|copos? americanos?|copos? de whisky|ta[cç]as? de vinho|jogo de vinho|coolers?|caixas? t[eé]rmicas?|bolsas? t[eé]rmicas?|kits? churrasco|espetos?|grelhas?|formas?|ramequins?|tigelas?|saladeiras?|travessas?|cestos? de p[aã]o|panificadora|p[aã]o de queijo|bandejas?|baldes?|abridor|abridor de latas|descascador de legumes|ralador|ralador de queijo|cortador|fatiador|cortador de frios|saca.?rolha|abridor de garrafas|escorredor de massa|passa legumes|ralador de alimentos|bicos? dosadores?|dosador(es)? (de|para) (vinagre|[oó]leo|molho|l[ií]quido|[aá]gua))\b/i, "cozinha"],
  [/\b(cama|colch[oõ]es?|guarda-roupas?|arm[aá]rios?|c[oô]modas?|estantes?|racks?|painel para tv|painel para televis[aã]o|escrivaninhas?|sof[aá]s?|poltronas?|mesas? de (jantar|centro|lateral)|cadeiras?|puffs?|banquetas?|bancos?|balc[aã]o|aparador(es)?|bufet|buf[eê]|criados? mudo|cabeceiras?|ber[cç]os?|bercos?|mois[eé]s|bebe comfort|balan[cç]os?|playgrounds?|cercadinhos?|cercados?)\b/i, "moveis"],
  [/\b(espelhos?|quadros?|lumin[aá]rias?|l[aâ]mpadas?|cortinas?|tapetes?|almofadas?|jogo de cama|toalhas?|organizador|vasos?|decorativo|decorac[aã]o|candlestick|terr[aá]rio|enfeite|portas? retrato)\b/i, "casa-decoracao"],
  [/\b(fog[aã]o|geladeira|freezer|micro.?ondas|airfryer|liquidificador|batedeira|cafeteira|lavadora|secadora|aspirador|purificador|umidificador|ventilador|ar condicionado|aquecedor|ferro de passar|climatizador|torre de ventila|desumidificador|circulador de ar|exaustor|frio port[aá]til|boiler|bebedouro)\b/i, "eletrodomesticos"],

  // ===== Esportes =====
  [/\b(bicicleta ergom[eé]trica|esteira|halter|halteres|anilha|el[aá]stico|kit treino|corda de pular|abdominal|crossfit|gin[aá]stica|yoga|pilates|peso|barra de peso|banco de supino|supino|rosca|extensora|mesa flexora|leg press|leg extension|leg curl|crossover|puxada|remada|crucifixo|desenvolvimento|panturrilha|stiff|afundo|avanco|agachamento|terra|hip thrust|gluteo|gl[uú]teo|costas|b[ií]ceps|tr[ií]ceps|ombro|peito|abdomen|core|circuito|treino|fitness|academia|gym|bodybuilding|muscula[cç][aã]o|suplemento|whey|creatina|bcaa|glutamina|pr[eé]-treino|termog[eê]nico|col[aá]geno|beta alanina|cafe[ií]na|hipercal[oó]rico|albumina|zma|magn[eé]sio|melatonina|5-htp|dmha|vitaminas e minerais|agilidade|argola de agilidade|bola de agilidade|escada de agilidade|kit agilidade|barra fixa|barra de porta|espaldeira)\b/i, "fitness"],
  [/\b(bicicleta|bike|capacete|pedal|guid[aã]o|selim|ciclista|mtb|gravel|rodovi[aá]ria|mountain bike|bike aro|bike infantil|bike dobravel|bike el[eé]trica|bike h[ií]brida|bike speed|bike fixa|bike track|bike downhill|bike enduro|bike trail|bike xc|bike all mountain|bike fat bike|bike de estrada|bike de montanha|bike de trilha|bike de competi[cç][aã]o|bike de lazer|bike de cidade|bike de passeio|bike de trekking|bike de adventure|bikepacking)\b/i, "ciclismo"],
  [/\b(barraca|sleeping bag|saco de dormir|mochila de camping|fogareiro|lampi[aã]o a g[aá]s|isolante|cadeira de camping|trilha|camping|acampamento|pescaria|pesca|carretilha|molinete|vara de pescar|isca|anzol|linha de pesca|chumbada|boia|machete|bip|buzina|kit sobreviv[eê]ncia|kit primeiros socorros|filtro de [aá]gua|purificador de [aá]gua|hydration|cantil|caneca t[eé]rmica|garrafa t[eé]rmica|manta t[eé]rmica|cama infl[aá]vel|colchonete|lanterna|lampi[aã]o|lanterna de cabe[cç]a|lanterna recarreg[aá]vel|bateria externa|power bank|carregador solar|painel solar|bateria solar|kit energia solar|gerador|gerador a gasolina|gerador a diesel|gerador a g[aá]s|gerador port[aá]til|inversor|controlador|bateria estacion[aá]ria|placa solar|placa fotovoltaica)\b/i, "camping"],
  [/\b(bola|halteres|el[aá]stico|esteira|bicicleta|patins|skate|raquete|rede de volei|bola de futebol|yoga|pilates|caneleira|luva de boxe|nata[cç][aã]o|esporte|esportes|futebol|v[oó]lei|basquete|handebol|t[eê]nis|badminton|ping pong|t[eê]nis de mesa|squash|futsal|apito|bomba (de|para) (bola|volei|v[oô]lei|futebol|basquete|penalty)|bomba penalty|bomba para bola|futebol society|futebol de campo|futebol de areia|futebol 7|futebol 5|futebol 3|futebol infantil|futebol juvenil|futebol master|futebol feminino|futebol masculino|futebol amador|futebol profissional|futebol internacional|futebol nacional|futebol estadual|futebol regional|futebol local|futebol de bairro|futebol de rua|futebol de vila)\b/i, "esporte-lazer"],

  // ===== Mercado =====
  [/\b(detergente|sab[aã]o em p[oó]|[aá]gua sanit[aá]ria|papel higi[eê]nico|alvejante|desinfetante|multiuso|limpador|desengordurante|amaciante|lava lou[cç]as|esponja|pano de ch[aã]o|pano|buj[aã]o de g[aá]s|g[aá]s|g[aá]s de cozinha|g[aá]s encanado|g[aá]s glp|g[aá]s p13|g[aá]s p45|g[aá]s industrial|g[aá]s medicinal|g[aá]s butano|g[aá]s propano|g[aá]s natural|g[aá]s lp|algicida|cloro (de|para) piscina|tratamento de piscina)\b/i, "limpeza-higiene"],
  [/\b(arroz|feij[aã]o|a[cç][uú]car|sal|azeite|[oó]leo|massa|biscoito|leite|cereal|granola|chocolate|doce|balas|snacks|pipoca|castanha|mel|geleia|palmito|atum|sardinha|conserva|farinha|amido|fub[aá]|mingau|aveia|muesli|cereais|bombom|docinho|bala|balinha|pirulito|chiclete|goma de mascar|droga|rem[eé]dio caseiro|ch[aá]|caf[eé]|caf[eé] torrado|caf[eé] mo[ií]do|caf[eé] em c[aá]psula|caf[eé] em gr[aã]o|caf[eé] sol[uú]vel|caf[eé] expresso|caf[eé] coado|caf[eé] v60|caf[eé] french press|caf[eé] aeropress|caf[eé] cold brew|caf[eé] cold|caf[eé] gelado|caf[eé] frapp[eé]|caf[eé] frappe|caf[eé] latte|caf[eé] cappuccino|caf[eé] macchiato|caf[eé] espresso|caf[eé] ristretto|caf[eé] lungo|caf[eé] doppio|caf[eé] americano|caf[eé] mocha|caf[eé] flat white|caf[eé] cortado|caf[eé] pingado|caf[eé] carioca|caf[eé] mineiro|caf[eé] paulista|caf[eé] fluminense|batata|nhoque|ravioli|sorvete|picol[eé]|iogurte|requeijão|requeijao|manteiga|margarina|maionese|ketchup|mostarda|molho de tomate|extrato de tomate|milho|ervilha|vagem)\b/i, "mercearia"],
  [/\b(cerveja|vinho|whisky|vodka|gin|energ[eé]tico|refrigerante|suco|[aá]gua|cerveja artesanal|kit churrasco|vinho tinto|espumante|destilado|licor|rum|cacha[cç]a|tequila|champagne|prosecco|sake|saquê|bourbon|scotch|mezcal|raicilla|sotol|bacanora|agave)\b/i, "alimentos-bebidas"],
  [/\b(arroz|feij[aã]o|a[cç][uú]car|sal|azeite|[oó]leo|massa|biscoito|cerveja|leite|detergente|sab[aã]o em p[oó]|[aá]gua sanit[aá]ria|papel higi[eê]nico|alvejante|desinfetante)\b/i, "supermercado"],
  [/\b(cachorro|gato|pet|racao|petisco para pet|areia para gato|coleira|tosa|veterin[aá]rio|aqu[aá]rio|passeio para c[aã]o|brinquedo para pet|cama para pet|petisco|areia|guia|peitoral|cinto|transportadora|gaiola|aquario|filtro|aerador|termometro|termostato|iluminacao|alga|antialga|medicamento|vitamina|suplemento|shampoo|condicionador|banho|higiene|escova|pente|corte|unha|orelha|olho|dente|boca|gengiva|periodontal|t[aá]rtaro|placa|bacteria|fungo|parasita|verme|carrapato|pulga|piolho|[aá]caro)\b/i, "pets"],

  // ===== Industrial / construção =====
  [/\b(disjuntor|contator|rel[eé]|sinaleiro|borne|cabo el[eé]trico|fio (el[eé]trico|de cobre|de alum[ií]nio|flex[ií]vel)|fios? el[eé]tricos?|fita isolante|interruptor|tomada|dr|varistor|capacitor|resistor|transformador|fonte (12v|24v|48v|chaveada|atx|at))\b/i, "eletrica"],
  [/\b(bomba|motor|compressor|motobomba|pressurizador|atuador|soprador|motor el[eé]trico|motor trif[aá]sico|motor monof[aá]sico|motor de indu[cç][aã]o|motor s[ií]ncrono|motor ass[ií]ncrono|motor de corrente contínua|motor de corrente alternada)\b/i, "bombas-motores"],
  [/\b(paqu[ií]metro|micr[oô]metro|rel[oó]gio comparador|comparador|trena digital|mult[ií]metro|amper[ií]metro|volt[ií]metro|dinam[oô]metro|balan[cç]a de precis[aã]o|instrumento de medi[cç][aã]o|n[ií]vel digital|n[ií]vel a laser|n[ií]vel de bolha|anem[oô]metro|anemometro|watt[ií]metro|wattimetro|meg[oô]hmetro|megohmetro|alicate amper[ií]metro|alicate.{0,20}(amp|amper|mult[ií]metro|terr[oô]metro|trena)|medidor de (energia|vaz[aã]o|press[aã]o))\b/i, "medicao-precisao"],
  [/\b(tinta|tinta spray|pincel|rolo de pintura|verniz|massa corrida|selador|impermeabilizante|corante|tinta acr[ií]lica|tinta l[aá]tex|thinner|tinta ep[oó]xi|tinta poliuretano)\b/i, "tinta-pintura"],
  [/\b(tinta|pincel|rolo de pintura|massa corrida|selador|impermeabilizante|cimento|argamassa|telha|tijolo|drywall|gesso|verniz|resina ep[oó]xi|assento.{0,25}(sanit|vaso|bacia|termofixo|soft.?close)|vaso sanit[aá]rio|vaso sanitario|bacia|lou[cç]as?|metais? sanit[aá]rios|caixa de descarga|ducha|hidraulica|hidr[aâ]ulica|torneira|misturador|chuveiro|cubas?|engate espiga|adaptador.{0,20}mangueira)\b/i, "construcao"],
  [/\b(planta|vaso de planta|terra vegetal|semente|regador|mangueira|grama|adubo|rede de descanso|rede de dormir|cortador de grama|piscina)\b/i, "jardim"],
  [/\b(furadeira|parafusadeira|serra|chave de fenda|trena|n[ií]vel|betoneira|compressor|solda|ferramenta|jogo de chaves|alicate|martelo|lima|arquivos?|banco de trabalho|bancada|torno|fresa|broca|escareador|reamer|macho|tarraxa|cossinete|morsa|bigorna|marreta|amolador|chaira|esmeril|esmerilhadeira|ma[cç]arico|ma[cç]arico de corte|ma[cç]arico de solda|ma[cç]arico de corte plasma|ma[cç]arico de corte oxicorte|ma[cç]arico de solda mig|ma[cç]arico de solda tig|ma[cç]arico de solda eletrodo|ma[cç]arico de solda arco|biseladora|curvador de (tubo|cano)|desentupidor|bedame|a[cç]o r[aá]pido)\b/i, "ferramentas"],
  [/\b(instrumento musical|viol[aã]o|guitarra|teclado musical|microfone|caixa de som|mesa de som|interface de [aá]udio)\b/i, "eletronicos"],
  [/\b(ind[uú]stria|equipamento industrial|m[aá]quina industrial|componente eletr[oô]nico|placa de circuito|sensor|motor el[eé]trico|motor industrial|motor trif[aá]sico|motor monof[aá]sico|motor de indu[cç][aã]o|motor s[ií]ncrono|motor ass[ií]ncrono|motor de corrente contínua|motor de corrente alternada)\b/i, "industria"],

  // ===== Outros / genéricos =====
  [/\b(mala de viagem|mochila de viagem|mala de m[aã]o|bagagem|necessaire de viagem|passagem a[eé]rea|passagem aerea|hotel|pacote de viagem|resort|pousada|airbnb|cruzeiro)\b/i, "viagem"],
  [/\b(ingresso para show|show|festival|teatro|cinema|ingresso|ingressos|evento|evento online|congresso|workshop|stand up|com[eé]dia)\b/i, "eventos"],
  [/\b(instrumento musical|viol[aã]o|guitarra|teclado musical|microfone|caixa de som|mesa de som|interface de [aá]udio|violino|baixo|cajon|pandeiro|surdo|tamborim|reco-reco|agogo|tri[aâ]ngulo|cântaro)\b/i, "eletronicos"],
];

// ===== Subtipos: refino dentro de cada categoria canonica =====
// Primeiro match vence; sem match -> null (aparece apenas em "Todos").
export interface SubtypeDef {
  slug: string;
  label: string;
  re: RegExp;
}

const SUBTYPES: Record<string, SubtypeDef[]> = {
  // --- Moda ---
  blusas: [
    { slug: "jaquetas-casacos", label: "Jaquetas e Casacos", re: /jaqueta|casaco|parka|blazer|couro|corta vento|bomber|puffer|trench|blus[aã]o|\bover\b|\bcoat\b/i },
    { slug: "moletom-tricot", label: "Moletom e Tricô", re: /moletom|hoodie|su[eé]ter|tricot|cardigan|canguru|mock/i },
    { slug: "camisetas-blusas", label: "Camisetas e Blusas", re: /camiseta|regata|camisa|blusa|top|body|polera|t[uú]nica|cropped|decote/i },
  ],
  calcas: [
    { slug: "shorts-bermudas", label: "Shorts e Bermudas", re: /shorts|bermuda|bermudas/i },
    { slug: "jeans-denim", label: "Jeans e Denim", re: /jeans|denim|mom jeans|wide leg|flare jeans|bootcut|cargo|saruel|rasgado/i },
    { slug: "leggings-pants", label: "Leggings e Pants", re: /legging|pantacourt|culotte|palazzo|cal[cç]a.{0,25}(capri|midi|wide|recta|slim|flare)/i },
    { slug: "saias", label: "Saias", re: /saia|saias|skirt/i },
  ],
  calcados: [
    { slug: "tenis", label: "Tênis", re: /t[eê]nis|sneaker|runner|sport|skate|chunky/i },
    { slug: "sandalias-chinelos", label: "Sandálias e Chinelos", re: /sand[aá]lia|chinelo|papete|rasteira|flatform|anabela|havaianas|ipanema|slipper|mule/i },
    { slug: "sapatos-social", label: "Sapatos Sociais", re: /sapato|scarpin|oxford|mocassim|loafer|peep|salto|stiletto|social|escrit[oó]rio|anabela|sand[aá]lia de salto/i },
    { slug: "botas", label: "Botas e Coturnos", re: /bota|coturno|botina|galocha|ankle|over knee/i },
  ],
  "calcados-infantil": [
    { slug: "sandalias-tenis", label: "Sandálias e Tênis", re: /sand[aá]lia|t[eê]nis|sapatenis|sapat[eê]nis/i },
    { slug: "sandalias-outros", label: "Outros Calçados", re: /chinelo|papete|bota|sapato|rasteirinha|sapatilha|tamanco|galocha/i },
  ],
  "moda-praia": [
    { slug: "biquini-sunga", label: "Biquíni e Sunga", re: /biqu[ií]ni|sunga|cavada|mai[oô]|sa[ií]da de praia|canga/i },
    { slug: "cover-ups", label: "Cover Ups e Acessórios", re: /cover|pare[oô]|t[uú]nica|camiseta de praia|sa[ií]da/i },
  ],
  "moda-praia-infantil": [
    { slug: "biquini-sunga", label: "Biquíni e Sunga", re: /biqu[ií]ni|sunga|cavada|mai[oô]/i },
    { slug: "roupas-praia", label: "Roupas de Praia", re: /bermuda|shorts|camiseta|body|cal[cç]a|sa[ií]da|praia/i },
  ],
  lingerie: [
    { slug: "conjuntos", label: "Conjuntos", re: /conjunto|kit|lingerie/i },
    { slug: "pijamas", label: "Pijamas e Sleeps", re: /pijama|camisola|sleepwear|descanso|moletom|negligee|baby doll/i },
    { slug: "calcinhas-sutias", label: "Calcinhas e Sutiãs", re: /calcinha|sutia|body|short|hot pant|meia cal[cç]a|push up/i },
  ],
  "moda-infantil": [
    { slug: "vestidos-conjuntos", label: "Vestidos e Conjuntos", re: /vestido|conjunto|macac[aã]o|jardineira|saia/i },
    { slug: "calcas-shorts", label: "Calças e Shorts", re: /cal[cç]a|shorts|bermuda|legging|jeans|denim/i },
    { slug: "blusas-camisetas", label: "Blusas e Camisetas", re: /blusa|camisa|camiseta|regata|moletom|hoodie|top|body|pijama|camisola/i },
    { slug: "moda-praia", label: "Moda Praia", re: /biqu[ií]ni|sunga|praia|canga|mai[oô]/i },
    { slug: "looks-acessorios", label: "Looks e Acessórios", re: /look|outfit|moda|fashion|estampad|listrad|roupa|vestuario|confec/i },
  ],
  "moda-feminina": [
    { slug: "social-formal", label: "Social e Formal", re: /social|formatura|casamento|elegante|sofisticado|executivo/i },
    { slug: "casual-cotidiano", label: "Casual e Cotidiano", re: /casual|dia a dia|confort|b[aá]sico|essential|essential/i },
    { slug: "moda-praia", label: "Moda Praia", re: /praia|biqu[ií]ni|sunga|canga|ver[aã]o|verao/i },
    { slug: "looks-estampados", label: "Looks e Estampados", re: /look|outfit|moda|fashion|estampad|listrad|xadrez|floral|confec|boutique|vestuario/i },
  ],
  "moda-masculina": [
    { slug: "social-escritorio", label: "Social e Escritório", re: /social|escrit[oó]rio|formal|terno|suit|sarja|alfaiataria/i },
    { slug: "casual-esporte", label: "Casual e Esporte", re: /casual|esporte|street|urban|jeans|denim|cargo|sarja/i },
    { slug: "looks-moda", label: "Looks e Moda", re: /look|outfit|moda|fashion|estampad|listrad|confec|vestuario|roupa|masculin|homem|senhor|garoto|boy|sarja|cargo|jeans|denim|street|urban|social|casual/i },
  ],
  vestidos: [
    { slug: "por-ocasiao", label: "Por Ocasião", re: /casamento|formatura|festa|casual|anivers[aá]rio|cerim[oô]nia|boho|praia/i },
    { slug: "estilo-caimento", label: "Estilo e Caimento", re: /midi|longuete|mini|m[aá]xi|maxi|rodado|flare|justo|solto|decote|al[cç]a|manga|tomara que caia|babado|assim[eé]trico/i },
  ],
  "bolsas-mochilas": [
    { slug: "bolsas", label: "Bolsas", re: /bolsa|pochete|riñonera|rinonera|crossbody|tiracolo|necessaire|pasta executiva/i },
    { slug: "mochilas", label: "Mochilas", re: /mochila|backpack|mochila escolar|mochila de viagem/i },
    { slug: "carteiras-cases", label: "Carteiras e Cases", re: /carteira|porta documentos|porta-cart[oõ]es|case|porta celular/i },
  ],
  "acessorios-moda": [
    { slug: "chapéus-bones", label: "Chapéus e Bones", re: /chap[eé]u|bone\b|bones\b|bon[eé]|gorro|touca|viseira|bucket|fedora|panama/i },
    { slug: "bijuterias", label: "Bijuterias", re: /brinco|colar|pulseira|anel|bijuteria|piercing|tiara|broche|grampos|scrunchie|amarrador|pingente/i },
    { slug: "cintos-carteiras", label: "Cintos e Carteiras", re: /cinto|carteira|porta-cart[oõ]es|porta documentos|case|porta-chaves/i },
    { slug: "lenços-cachecóis", label: "Lenços e Cachecóis", re: /len[cç]o|lenco|cachecol|bandana|xale|estola|gorro|meia|meias|headband/i },
  ],
  oculos: [
    { slug: "sol", label: "Óculos de Sol", re: /sol|aviador|ray-?ban|wayfarer|espelhado|polarizado/i },
    { slug: "grau", label: "Óculos de Grau", re: /grau|receita|filtro azul|anti-?reflexo|anti reflexo|progressivo|bifocal|fotochromic/i },
  ],
  "joias-relogios": [
    { slug: "brincos-colares", label: "Brincos e Colares", re: /brinco|colar|pingente|berloque|choker|gargantilha|brincos|colares/i },
    { slug: "aneis-pulseiras", label: "Anéis e Pulseiras", re: /anel|pulseira|tornozeleira|aneis|pulseiras/i },
    { slug: "relogios", label: "Relógios", re: /rel[oó]gio|relogio|smartwatch|watch/i },
    { slug: "terços-religiosos", label: "Terços e Religiosos", re: /ter[cç]o|terco|ros[aá]rio|rosario|amuleto|medalha|imagem religiosa|escapul[aá]rio/i },
  ],
  // --- Beleza ---
  maquiagem: [
    { slug: "labios", label: "Lábios", re: /batom|gloss|balm labial|protetor labial|lip/i },
    { slug: "olhos", label: "Olhos", re: /r[ií]mel|delineador|sombra|c[ií]lios|lash|brow|sobrancelha|extensor/i },
    { slug: "rosto", label: "Rosto", re: /base|corretivo|blush|iluminador|p[oó]|compacto|primer|fixador|contour|contorno|bb cream|protetor solar/i },
    { slug: "unhas", label: "Unhas", re: /esmalte|vidro de unhas|top coat|base coat|removedor|cuticle|gel/i },
    { slug: "kits-acessorios", label: "Kits e Acessórios", re: /kit|pincel|esponja|necessaire|makeup|make/i },
  ],
  cabelo: [
    { slug: "shampoo-condicionador", label: "Shampoo e Condicionador", re: /shampoo|xampu|condicionador|creme para pentear/i },
    { slug: "tratamentos", label: "Tratamentos", re: /m[aá]scara|progressiva|botox|cronograma|finalizador|[oó]leo capilar|hidratante|serum|leave in|tratamento/i },
    { slug: "modeladores", label: "Modeladores", re: /chapinha|prancha|modelador|escova modeladora|babyliss|cachos/i },
    { slug: "acessorios-cabelo", label: "Acessórios", re: /pente|escova|touca|el[aá]stico|presilha|grampos|gorros|tiara/i },
  ],
  skincare: [
    { slug: "facial", label: "Facial", re: /s[eé]rum|hidratante|protetor solar|[aá]cido|vitamina c|niacinamida|retinol|t[oô]nico|ess[eê]ncia|bb cream|cc cream|dermocosm[eé]tico/i },
    { slug: "corporal", label: "Corporal", re: /corporal|esfoliante|sabonete|creme corporal|protetor corporal/i },
    { slug: "limpeza-skincare", label: "Limpeza e Máscaras", re: /micelar|demaquilante|gel de limpeza|m[aá]scara|sheet mask|sleeping mask|balsamo|limpeza/i },
  ],
  perfumaria: [
    { slug: "masculino", label: "Masculino", re: /masculino|col[oô]nia masculina|desodorante masculino/i },
    { slug: "feminino", label: "Feminino", re: /feminino|col[oô]nia feminina|desodorante feminino|body splash/i },
    { slug: "importados-nicho", label: "Importados e Nicho", re: /[aá]rabe|oud|[aá]mbar|vetiver|moschino|importado|nicho|frag[aâ]ncia/i },
    { slug: "colonias-desodorantes", label: "Colônias e Desodorantes", re: /col[oô]nia|colonia|desodorante|body splash|eau de|perfume/i },
  ],
  beleza: [
    { slug: "cabelo", label: "Cabelo", re: /cabelo|shampoo|xampu|condicionador|finalizador|progressiva|modelador|escova|chapinha|prancha|cronograma/i },
    { slug: "unhas", label: "Unhas", re: /esmalte|unha|vidro de unhas|cuticle|removedor|top coat|base coat/i },
    { slug: "maquiagem", label: "Maquiagem", re: /batom|maquiagem|r[ií]mel|delineador|base|corretivo|blush|sombra|iluminador|make|gloss|l[ií]pia/i },
    { slug: "skincare-corporal", label: "Skincare e Corporal", re: /creme|hidratante|s[eé]rum|protetor solar|esfoliante|sabonete|[aá]cido|vitamina c|niacinamida|retinol|dermocosm[eé]tico|col[aá]geno|corporel/i },
    { slug: "spa-estetica", label: "Spa e Estética", re: /spa|massagem|harmoniza[cç][aã]o|depila[cç][aã]o|est[eé]tica|drenagem|terapia/i },
  ],
  "beleza-infantil": [
    { slug: "higiene", label: "Higiene e Banho", re: /sabonete|shampoo|higiene|banho|higi[eê]nico|wipes|toalha/i },
    { slug: "skincare-corporal", label: "Skincare e Corporal", re: /creme|hidratante|protetor solar|repelente|pomada|dermatol[oó]gico/i },
    { slug: "cabelo", label: "Cabelo", re: /cabelo|shampoo|condicionador|modelador|finalizador/i },
  ],
  saude: [
    { slug: "remedios-otc", label: "Remédios e OTC", re: /rem[eé]dio|medicamento|antibi[oó]tico|anti-inflamat[oó]rio|analg[eé]sico|dorflex|anti-al[eé]rgico|anti-histam[ií]nico|antif[uú]ngico|gen[eé]rico|similar/i },
    { slug: "primeiros-socorros", label: "Primeiros Socorros", re: /curativo|gaze|soro fisiol[oó]gico|compressa|banda|bandagem|kit primeiros socorros|antiss[eé]ptico|protetor|epi\b/i },
    { slug: "monitoramento", label: "Monitoramento", re: /term[oô]metro|glicos[ií]metro|press[aã]o|ox[ií]metro|gravidez|monitor|frequ[eê]ncia/i },
    { slug: "higiene-saude", label: "Higiene e Saúde", re: /higiene|absorbente|protetor|higi[eê]nico|limpeza|desinfetante/i },
  ],
  suplementos: [
    { slug: "whey-proteina", label: "Whey e Proteína", re: /whey|prote[ií]na|protein|albumina|mass gainer|hipercal[oó]rico/i },
    { slug: "creatina-bcaa", label: "Creatina e BCAA", re: /creatina|bcaa|glutamina|beta alanina|cafe[ií]na|pr[eé]-?treino/i },
    { slug: "vitaminas-minerais", label: "Vitaminas e Minerais", re: /vitamina|multivitam[ií]nico|mineral|col[aá]geno|magn[eé]sio|zma|melatonina|5-htp/i },
    { slug: "emagrecimento", label: "Emagrecimento e Queima", re: /termog[eê]nico|emagrecimento|apetite|akkerm|fibra|psyllium|dmha/i },
  ],
  // --- Casa ---
  moveis: [
    { slug: "sofa-poltrona", label: "Sofá e Poltrona", re: /sof[aá]|poltrona|puff|reclin[aá]vel|retr[aá]til/i },
    { slug: "quarto-bebe", label: "Quarto de Bebê", re: /ber[cç]o|berco|mois[eé]s|cercadinho|carrinho de beb[eê]|bebe comfort|balan[cç]o|playground|redinha/i },
    { slug: "armario-estante", label: "Armários e Estantes", re: /arm[aá]rio|armario|guarda-roupa|closet|estante|aparador|buf[eê]|criado|c[oô]moda|comoda|rack/i },
    { slug: "cama-colchao", label: "Cama e Colchão", re: /cama|colch[aã]o|colchao|box|beliche|solteiro|casal/i },
    { slug: "mesa-cadeira", label: "Mesas e Cadeiras", re: /mesa|cadeira|escrivaninha|banco|banqueta|balc[aã]o|balcao|rack|home office/i },
  ],
  cozinha: [
    { slug: "panelas-assadeiras", label: "Panelas e Assadeiras", re: /panela|frigideira|assadeira|forma de bolo|leiteira|wok|grill|ca[cç]arola|panela de press[aã]o/i },
    { slug: "utensilios-talheres", label: "Utensílios e Talheres", re: /utens[ií]lio|talher|faca|tabua|descascador|ralador|espremedor|abridor|saca.?rolha|fatiador|cortador|passa legumes|escorredor|colher|pegador|esp[aá]tula|dosador|aerador|batedor|bandeja|peneira|coador|funil|medidor|bico dosador|ralo|porta papel|porta guardanapo/i },
    { slug: "copos-taças", label: "Copos e Taças", re: /copo|ta[cç]a|caneca|x[ií]cara|xicara|jarra|garrafa (t[eé]rmica|de vidro|de vinho|para vinho)|squeeze|cooler|copo americano|kit copos|pires|bule/i },
    { slug: "organizacao-cozinha", label: "Organização", re: /organizador|porta|dispensador|lixeira|cesto|cabide|porta tempero|porta talheres|organizadora|balde|porta papel|porta guardanapo/i },
  ],
  "eletrodomesticos": [
    { slug: "refrigeracao", label: "Refrigeração", re: /geladeira|freezer|frigor[ií]fico|frigo|refrigerador/i },
    { slug: "lavanderia", label: "Lavanderia", re: /lavadora|secadora|lavar|tanquinho|m[aá]quina de lavar/i },
    { slug: "cozinha-eletro", label: "Cozinha Elétrica", re: /fog[aã]o|fogao|cozinha|forno|cooktop|micro-?ondas|airfryer|fritadeira/i },
    { slug: "preparacao", label: "Preparo de Alimentos", re: /liquidificador|batedeira|processador|cafeteira|torradeira|pipoqueira|sorveteira|juicer/i },
    { slug: "clima-conforto", label: "Clima e Conforto", re: /purificador|umidificador|desumidificador|aquecedor|ventilador|climatizador/i },
  ],
  "eletro-cocina": [
    { slug: "fritadeiras", label: "Fritadeiras", re: /air ?fryer|airfryer|fritadeira|grelhador|grill|sandwichera|sanduicheira|panela el[eé]trica/i },
    { slug: "preparacao", label: "Preparo de Alimentos", re: /liquidificador|batedeira|processador|juicer|extrator|pipoqueira|chocolateira|galeteira|sorveteira/i },
    { slug: "cafes", label: "Cafés e Máquinas", re: /cafeteira|m[aá]quina de caf[eé]|m[aá]quina de espresso|nespresso|torradeira|chaleira/i },
    { slug: "fornos-cooktops", label: "Fornos e Cooktops", re: /cooktop|forno|micro-?ondas|panela de press[aã]o el[eé]trica/i },
  ],
  "eletro-limpeza": [
    { slug: "aspiradores", label: "Aspiradores", re: /aspirador|robo aspirador|vassoura el[eé]trica|mop el[eé]trico|escova el[eé]trica/i },
    { slug: "lavagem", label: "Lavagem", re: /lava.?lou[cç]as|lava roupas|m[aá]quina de lavar|secadora/i },
    { slug: "costura-passadoria", label: "Costura e Passadoria", re: /m[aá]quina de costura|overlock|m[aá]quina de bordar|ferro de passar|ferro el[eé]trico|central de passar/i },
    { slug: "selagem-outros", label: "Selagem e Outros", re: /seladora|umidificador|desumidificador|cortador de grama/i },
  ],
  climatizacao: [
    { slug: "ar-condicionado", label: "Ar-Condicionado", re: /ar.?condicionado|split|ar condicionado|polo|janela|hi wall/i },
    { slug: "aquecimento", label: "Aquecimento", re: /aquecedor|climatizador|aquecedor a g[aá]s|aquecedor el[eé]trico|climatizador de ambiente/i },
    { slug: "ventilacao", label: "Ventilação", re: /ventilador|torre de ventila|circulador|exaustor|ventoinha|ventilador de teto|coluna|parede/i },
    { slug: "purificacao-umidade", label: "Purificação e Umidade", re: /purificador|umidificador|desumidificador|purificador de ar/i },
  ],
  "textil-cama": [
    { slug: "jogos-cama", label: "Jogos de Cama", re: /jogo de cama|len[cç][oó]is|fronha|travesseiro|edredom|cobertor|manta|protetor de colch[aã]o/i },
    { slug: "toalhas", label: "Toalhas", re: /toalha|lencol|toalha de banho|toalha de rosto|toalha de m[aã]o/i },
    { slug: "cortinas-almofadas", label: "Cortinas e Almofadas", re: /cortina|persiana|almofada|capa de almofada|jogo americano|guardanapo|tapete/i },
    { slug: "mesa-cozinha", label: "Mesa e Cozinha", re: /jogo de toalha|capa de mesa|porta tempero|porta talheres|a[cç]ucareira|leiteira|bule|pires|ta[cç]as|copos|canecas|cestos|organizador de cozinha/i },
  ],
  decoracao: [
    { slug: "quadros-vasos", label: "Quadros e Vasos", re: /quadro|vaso decorativo|espelho|lousa|porta retrato|painel decorativo/i },
    { slug: "flores-arranjos", label: "Flores e Arranjos", re: /flor|flores|arranjo|crisantemo|rosas|girassol|tulipa|orqu[ií]dea|astrom[eé]lia|margarida|cravo|jasmim|lavanda|hort[eê]nsia|pe[oô]nia|d[áa]lia|l[ií]rio|costela de ad[aã]o|suculenta|cacto|bambu/i },
    { slug: "enfeites-tematicos", label: "Enfeites", re: /enfeite|decora[cç][aã]o|decorativo|natal|pres[eé]pio|[aá]rvore|banderinha|sininho|vela|candlestick|terr[aá]rio|cachep[oô]|suporte para plantas/i },
  ],
  organizacao: [
    { slug: "closet-guarda", label: "Closet e Guarda-Roupa", re: /sapateira|closet|porta.chaves|porta documentos|mala direta|cabide|organizador de closet/i },
    { slug: "cozinha", label: "Cozinha", re: /organizador de cozinha|porta tempero|porta talheres|dispensador|lixeira|cesto organizador/i },
    { slug: "escritorio", label: "Escritório", re: /organizador de mesa|porta canetas|suporte|caixa organizadora|organizador de gaveta|porta.monitor/i },
    { slug: "caixas-gavetas", label: "Caixas e Gavetas", re: /caixa|gaveta|nicho|prateleira|sacola organizadora|organizador de sapato/i },
  ],
  iluminacao: [
    { slug: "led", label: "LED e Fitas", re: /fita de led|perfil de led|kit led|painel de led|refletor led|l[aâ]mpada led|lampada led|sensor de presen[cç]a/i },
    { slug: "lustres-pendentes", label: "Lustres e Pendentes", re: /lustre|pendente|lustre de cristal|lustre moderno/i },
    { slug: "arandelas-spots", label: "Arandelas e Spots", re: /arandela|spot|plafon|abajur|lumin[aá]ria de mesa|lumin[aá]ria de piso|aplique/i },
    { slug: "externos", label: "Externos e Jardim", re: /refletor|lumin[aá]ria externa|post top|solar|garden|jardim/i },
    { slug: "interruptores-dimmers", label: "Interruptores e Dimmers", re: /interruptor|dimmer|sensor/i },
  ],
  "casa-decoracao": [
    { slug: "flores-artificiais", label: "Flores Artificiais", re: /bico de papagaio|berry|flor|arranjo|crisantemo|rosas|girassol|tulipa|orqu[ií]dea|astrom[eé]lia|margarida|cravo|jasmim|lavanda|hort[eê]nsia|pe[oô]nia|d[áa]lia|l[ií]rio|costela de ad[aã]o|suculenta|cacto|bambu|ant[uú]rio|bauhinia|anjo|pinha|natal|outono/i },
    { slug: "textil-decor", label: "Têxtil Decorativo", re: /cortina|almofada|tapete|jogo americano|toalha|lencol|fronha|edredom|cobertor|manta/i },
    { slug: "decorativo", label: "Decorativo", re: /quadro|vaso|espelho|enfeite|decora[cç][aã]o|decorativo|lumin[aá]ria|l[aâ]mpada|organizador|candlestick|terr[aá]rio/i },
  ],
  // --- Tecnologia ---
  informatica: [
    { slug: "notebooks", label: "Notebooks", re: /notebook|laptop|macbook|chromebook|notebook gamer/i },
    { slug: "desktops-pc", label: "Desktops e PCs", re: /pc gamer|computador|desktop|all in one|torre|gabinete|\bpc\b/i },
    { slug: "monitores-perifericos", label: "Monitores e Periféricos", re: /monitor|teclado|mouse|webcam|headset|perif[eé]ricos|mousepad|mouse sem fio|mouse bluetooth|monitor gamer/i },
    { slug: "armazenamento-memoria", label: "Armazenamento e Memória", re: /ssd|hd externo|mem[oó]ria|ram|ddr|pendrive|cart[aã]o de mem[oó]ria|hd\b/i },
    { slug: "componentes", label: "Componentes", re: /processador|placa de v[ií]deo|placa m[aã]e|fonte|cooler|water cooler|placa de som|placa de rede|nobreak|no break/i },
  ],
  celulares: [
    { slug: "smartphones", label: "Smartphones", re: /celular|smartphone|iphone|galaxy|xiaomi|motorola|redmi|poco|realme|samsung|android|iphone/i },
    { slug: "acessorios-celular", label: "Acessórios", re: /capinha|pel[ií]cula|case|suporte|carregador|cabo|fone|pulseira|capa|prote[cç][aã]o|kit celular|dock/i },
  ],
  games: [
    { slug: "consoles", label: "Consoles", re: /playstation|ps[45]|xbox|nintendo|switch|console/i },
    { slug: "jogos", label: "Jogos", re: /jogo|games|dlc|jogo digital|game|jogo de/i },
    { slug: "acessorios-games", label: "Acessórios", re: /controle|headset|cadeira gamer|volante|joystick|dock|carregador|mesa gamer|stream/i },
  ],
  "tv-audio": [
    { slug: "televisores", label: "Televisores", re: /\btv\b|televis[aã]o|smart tv|painel|tv 4k|tv\b/i },
    { slug: "audio-casa", label: "Áudio para Casa", re: /caixa de som|soundbar|home theater|caixa de som bluetooth/i },
    { slug: "fones", label: "Fones e Headsets", re: /fone|headset|fone bluetooth|fone sem fio|fone de ouvido|earbuds|airpods/i },
    { slug: "projetores", label: "Projetores", re: /projetor|projetor led|home cinema/i },
  ],
  fotografia: [
    { slug: "cameras", label: "Câmeras", re: /c[aâ]mera|camera|dslr|mirrorless|gopro|filmadora|c[aâ]mera digital/i },
    { slug: "drones", label: "Drones", re: /drone|drones/i },
    { slug: "lentes-acessorios", label: "Lentes e Acessórios", re: /lente|lentes|trip[eé]|gimbal|stabilizador|monop[eé]|microfone|carregador de c[aâ]mera|bolsa de c[aâ]mera|selfie stick|filme|memory card|cart[aã]o de mem[oó]ria/i },
  ],
  software: [
    { slug: "sistemas-windows", label: "Sistemas", re: /windows|office|microsoft|antiv[ií]rus|vpn|licen[cç]a|assinatura/i },
    { slug: "criativo-adobe", label: "Criativo e Adobe", re: /adobe|photoshop|illustrator|premiere|after effects|lightroom|indesign|autocad|solidworks|revit|sketchup|blender|cinema 4d/i },
    { slug: "cursos-online", label: "Cursos e E-books", re: /curso|e-book|livro digital|template|wordpress|stock|assinatura/i },
  ],
  eletronicos: [
    { slug: "som-audio", label: "Som e Áudio", re: /caixa de som|soundbar|home theater|fone|headset|microfone|caixa ac[uú]stica/i },
    { slug: "acessorios-eletronicos", label: "Acessórios", re: /carregador|cabo|adaptador|capinha|pel[ií]cula|case|suporte|dock|base|prote[cç][aã]o/i },
    { slug: "projetores-tv", label: "Projetores e TVs", re: /projetor|tv|televis[aã]o|smart tv|receptor|antena|hdmi/i },
  ],
  // --- Esportes ---
  "esporte-lazer": [
    { slug: "bolas", label: "Bolas", re: /bola|bolas|futebol|basquete|v[oô]lei|handebol|t[eê]nis|badminton|squash|frescobol/i },
    { slug: "raquetes", label: "Raquetes e Mesa", re: /raquete|t[eê]nis de mesa|ping.?pong|badminton|squash|frescobol|t[eê]nis/i },
    { slug: "patins-skate", label: "Patins e Skate", re: /patins|skate|longboard|penny|hoverboard|patinete|monociclo|casco/i },
    { slug: "boxe-martial", label: "Boxe e Artes Marciais", re: /boxe|muay thai|jiu-?jitsu|karat[eê]|jud[oô]|taekwondo|luva de boxe|bandagem|protetor bucal|shin guard|canel[eê]ira/i },
    { slug: "academia-rua", label: "Academia de Rua", re: /halter|anilha|barra|crossfit|calistenia|street workout|banco de supino|el[aá]stico|corda de pular|abdominal|kit treino|yoga|pilates/i },
  ],
  "esporte-infantil": [
    { slug: "bolas", label: "Bolas", re: /bola|bolas|futebol|basquete|v[oô]lei|t[eê]nis/i },
    { slug: "bicicletas", label: "Bicicletas", re: /bicicleta|bike|patinete|trenzinho|carrinho|velocipede/i },
    { slug: "brinquedos-esporte", label: "Brinquedos Esportivos", re: /skate|patins|hoverboard|raquete|capacete|esporte|lazer|parque/i },
  ],
  fitness: [
    { slug: "musculacao-pesos", label: "Musculação e Pesos", re: /halter|anilha|barra|supino|rosca|leg press|crossover|banco|peso|extensora|mesa flexora|leg extension|leg curl|puxada|remada|crucifixo|desenvolvimento|panturrilha|stiff|afundo|avanco|agachamento|terra|hip thrust|gluteo|gl[uú]teo|costas|b[ií]ceps|tr[ií]ceps|ombro|peito|abdomen|core/i },
    { slug: "cardio", label: "Cardio", re: /esteira|bicicleta ergom[eé]trica|el[ií]ptico|remo|spinning|cardio/i },
    { slug: "yoga-pilates-corpo", label: "Yoga, Pilates e Corpo", re: /yoga|pilates|tapete|corda de pular|abdominal|gin[aá]stica|alongamento|faixa el[aá]stica|kit treino|treino/i },
    { slug: "agilidade", label: "Agilidade", re: /agilidade|argola|escada|kit agilidade|bola de agilidade|bateria de agilidade|bateria/i },
  ],
  ciclismo: [
    { slug: "bicicletas", label: "Bicicletas", re: /bicicleta|bike|mtb|gravel|rodovi[aá]ria|mountain|speed|fixa|track|downhill|enduro|trail|xc|all mountain|fat bike|estrada|montanha|trilha|competição|lazer|cidade|passeio|trekking|adventure|bikepacking|aro/i },
    { slug: "equipamentos", label: "Equipamentos", re: /capacete|pedal|guid[aã]o|selim|ciclista|kit|traje|luva|[oó]culos|calcado|sapato|t[eê]nis|bicicleta ergom[eé]trica|rolinho|suporte|rack|bolsa/i },
  ],
  camping: [
    { slug: "barracas-sleeping", label: "Barracas e Sleeping Bags", re: /barraca|sleeping bag|saco de dormir|isolante|cama infl[aá]vel|colchonete|filtro de [aá]gua|purificador de [aá]gua|hydration/i },
    { slug: "pesca", label: "Pesca", re: /pescaria|pesca|carretilha|molinete|vara de pescar|isca|anzol|linha de pesca|chumbada|boia/i },
    { slug: "energia-iluminacao", label: "Energia e Iluminação", re: /lanterna|lampi[aã]o|bateria externa|power bank|carregador solar|painel solar|bateria solar|kit energia solar|gerador|inversor|controlador|bateria estacion[aá]ria|placa solar|placa fotovoltaica|mochila de camping|fogareiro|cantil|caneca t[eé]rmica|garrafa t[eé]rmica|manta t[eé]rmica/i },
    { slug: "sobrevivencia-primeiros", label: "Sobrevivência", re: /kit sobreviv[eê]ncia|kit primeiros socorros|machete|bip|buzina|trilha|camping|acampamento/i },
  ],
  // --- Auto / Industrial ---
  "pecas-veiculos": [
    { slug: "motor-interno", label: "Motor e Internos", re: /motor|bomba|vela|correia|pist[aã]o|virabrequim|c[aá]rter|carter|compressor|tensionador|bico injetor|coxim|suporte de motor/i },
    { slug: "freios-suspensao", label: "Freios e Suspensão", re: /pastilha|disco de freio|amortecedor|coxim|piv[oô]|terminal|bieleta|suspens[aã]o|molas|cubo de roda|ponta de eixo|cardan|semieixo|semi.?eixo|homocin[eé]tica/i },
    { slug: "transmissao-cambio", label: "Transmissão e Câmbio", re: /c[aâ]mbio|cambio|embreagem|embreagem kit|embreagem|embreagem kit/i },
    { slug: "eletrica-auto", label: "Elétrica Automotiva", re: /bateria|alternador|motor de arranque|sinaleiro|rel[eé]|filtro|sensor|bobina|igni[cç][aã]o|sonda lambda|sensor de oxig[eê]nio|vela de igni[cç][aã]o/i },
    { slug: "carroceria-exterior", label: "Carroceria e Exterior", re: /parachoque|para-choque|farol|lanterna|retrovisor|radiador|grade|cap[oô]|para-lama|espelho|protetor de (motor|tanque|carenagem|quadro|carroceria)|quebra vento|capa de moto|hitch|engate.{0,25}(reboque|trailer|carro|moto|implemento|carreta)|reboque/i },
    { slug: "pneus-rodas", label: "Pneus e Rodas", re: /pneu|pneus|aro|roda|calota|estepe|macaco|tri[aâ]ngulo|cubo de roda|rodado/i },
    { slug: "acessorios-moto", label: "Acessórios de Moto", re: /bagageiro|bauleto|ba[uú]leto|alforje|top.?case|mala para moto|protetor de carenagem|protetor de quadro|capa de moto|protetor de tanque|bolsa|bag|maleta/i },
  ],
  automotivo: [
    { slug: "cuidados-limpeza", label: "Cuidados e Limpeza", re: /cera|polidor|shampoo|detalhante|limpador|shampoo automotivo|couro|cheiro|odorizador|lavagem|selante|silicone|adesivo/i },
    { slug: "comodidade-conforto", label: "Comodidade e Conforto", re: /organizador|suporte|encosto|protetor|apoio|almofada|capa de banco|tapete automotivo|capa de volante|volante|porta objetos|porta-trecos|porta celulas/i },
    { slug: "seguranca-tecnologia", label: "Segurança e Tecnologia", re: /c[aâ]mera|sensor|alarme|rastreador|multim[ií]dia|tela|som|central|receptor|antena|desemba[cç]ador|cerca|alarme/i },
  ],
  ferramentas: [
    { slug: "acessorios-ferramentas", label: "Acessórios", re: /broca|disco|lixa|ponta|bits?|acess[oó]rio|maleta|estojo|organizador/i },
    { slug: "furadeiras-parafusadeiras", label: "Furadeiras e Parafusadeiras", re: /furadeira|parafusadeira|impacto|martelo|furadeira de impacto/i },
    { slug: "serras-cortes", label: "Serras e Cortes", re: /serra|serra circular|serrote|cut-?off|sabre|rec[ií]proca|jigsaw|biseladora|desentupidor|bedame|a[cç]o r[aá]pido/i },
    { slug: "chaves-alicates", label: "Chaves e Alicates", re: /alicate|chave de|jogo de chaves|chave inglesa|chave combinada|chave fenda|philips|allen|torx|hex/i },
    { slug: "solda-esmeril", label: "Solda e Esmeril", re: /solda|ma[cç]arico|esmeril|esmerilhadeira|rebarbadora|politriz|angle grinder/i },
  ],
  "fixacao-metalica": [
    { slug: "abraçadeiras-perfis", label: "Abraçadeiras e Perfis", re: /abra[cç]adeira|perfil|cantoneira|chapa|barra|perfilado|tipo u|tipo d/i },
    { slug: "buchas-cavilhas", label: "Buchas e Cavilhas", re: /bucha|cavilha|chumbador|espiral|dowel|[aâ]ncora|ancora|trava|anel de reten[cç][aã]o/i },
    { slug: "parafusos-porcas", label: "Parafusos e Porcas", re: /parafuso|porca|rebite|grampo|barra roscada|tirante|flange|pino/i },
    { slug: "arruelas-anilhas", label: "Arruelas e Anilhas", re: /arruela|anilha|arruela de press[aã]o|grower|dentada|lisa/i },
  ],
  "quimica-industrial": [
    { slug: "adesivos-colas", label: "Adesivos e Colas", re: /adesivo|cola|loctite|super cola|cianoacrilato|ep[oó]xi|poxy|adesivo estrutural|trava rosca/i },
    { slug: "lubrificantes", label: "Lubrificantes e Óleos", re: /lubrificante|graxa|[oó]leo|desengripante|penetrante|silicone lubrificante|removedor/i },
    { slug: "selantes-massas", label: "Selantes e Massas", re: /selante|vedacit|massa|massa corrida|estopa|fita vedação|vedação|silicone (ac[ií]tico|neutro|de vedação|selante|para vidros?|para banheiro|para pia|metais?)|resina/i },
    { slug: "quimicos-diversos", label: "Químicos Diversos", re: /qu[ií]mico|[aá]lcool|solvente|thinner|removedor|removedor de|desengordurante/i },
  ],
  eletrica: [
    { slug: "disjuntores-componentes", label: "Disjuntores e Componentes", re: /disjuntor|contator|rel[eé]|sinaleiro|borne|varistor|capacitor|resistor|transformador|protetor/i },
    { slug: "fios-cabos", label: "Fios e Cabos", re: /cabo el[eé]trico|fio el[eé]trico|fio de cobre|fio de alum[ií]nio|fio flex[ií]vel|cabo flex[ií]vel|fita isolante|isolante/i },
    { slug: "tomadas-interruptores", label: "Tomadas e Interruptores", re: /tomada|interruptor|caixa de passagem|eletroduto|condu[ií]te/i },
    { slug: "fontes-alimentacao", label: "Fontes e Alimentação", re: /fonte|fonte 12v|fonte 24v|fonte chaveada|fonte atx|fonte 80 plus|no break|nobreak/i },
  ],
  "bombas-motores": [
    { slug: "bombas-agua", label: "Bombas de Água", re: /bomba|motobomba|pressurizador|bomba perif[eé]rica|bomba submersa|bomba de po[cç]o/i },
    { slug: "motores", label: "Motores", re: /motor|motor el[eé]trico|motor trif[aá]sico|motor monof[aá]sico|motor de indu[cç][aã]o|motor s[ií]ncrono|motor ass[ií]ncrono|motor de corrente/i },
    { slug: "compressores", label: "Compressores", re: /compressor|compressor de ar/i },
    { slug: "atuadores-diversos", label: "Atuadores e Diversos", re: /atuador|soprador|motorreductor|redutor/i },
  ],
  "medicao-precisao": [
    { slug: "paquimetros", label: "Paquímetros e Micrômetros", re: /paqu[ií]metro|micr[oô]metro|trena digital/i },
    { slug: "multimetros", label: "Multímetros e Amperímetros", re: /mult[ií]metro|amper[ií]metro|volt[ií]metro|watt[ií]metro|meg[oô]hmetro|alicate amper[ií]metro|megger/i },
    { slug: "niveis-inclinometros", label: "Níveis e Inclinômetros", re: /n[ií]vel|n[ií]vel digital|n[ií]vel a laser|n[ií]vel de bolha|inclin[oô]metro|esquadro/i },
    { slug: "balancas-medidores", label: "Balanças e Medidores", re: /balan[cç]a de precis[aã]o|dinam[oô]metro|medidor|anem[oô]metro|medidor de energia|medidor de vaz[aã]o|medidor de press[aã]o|man[oô]metro/i },
  ],
  construcao: [
    { slug: "materiais", label: "Materiais de Construção", re: /cimento|argamassa|telha|tijolo|drywall|gesso|bloco|areia|brita|concreto|impermeabilizante/i },
    { slug: "loucas-sanitarias", label: "Louças e Metais Sanitários", re: /assento|bacia|vaso sanit[aá]rio|vaso sanitario|dec[aá]l|docol|tupan|lou[cç]a|sanit[aá]rio|chuveiro|torneira|misturador|registro|v[aá]lvula|valvula|monocomando|ralo|caixa de descarga|ducha|bid[eê]|pia|cubas?|metais sanit[aá]rios|griferia|acabamento.{0,25}(chuveiro|torneira|registro|v[aá]lvula|valvula|monocomando|sanit[aá]rio)/i },
    { slug: "hidraulica", label: "Hidráulica", re: /cano|tubo|joelho|luva|registro|torneira|adaptador|sif[aã]o|caixa d'?[aá]gua|reservat[oó]rio/i },
    { slug: "acabamento", label: "Acabamento", re: /massa corrida|selador|verniz|impermeabilizante|resina ep[oó]xi|cola para azulejo|rejunte|argamassa|textura|tinta|acr[ií]lico|suvinil|ripado|painel|forro|sanca|moldura|rodap[eé]|rodape/i },
  ],
  "tinta-pintura": [
    { slug: "tintas", label: "Tintas", re: /tinta|tinta l[aá]tex|tinta acr[ií]lica|tinta ep[oó]xi|tinta poliuretano|tinta spray|tinta para parede|tinta para madeira|tinta para ferro|tinta automotiva/i },
    { slug: "ferramentas-pintura", label: "Ferramentas", re: /pincel|rolo de pintura|spray|bandeja|kit pintura|extensor|luva de pintura|mascara de pintura/i },
    { slug: "preparacao", label: "Preparação e Massas", re: /massa corrida|selador|primer|fundo preparador|verniz|stain|corante|textura|massa acr[ií]lica/i },
  ],
  jardim: [
    { slug: "plantas", label: "Plantas e Sementes", re: /planta|vaso de planta|semente|grama|adubo|muda|arbusto|cacto|suculenta/i },
    { slug: "ferramentas-jardim", label: "Ferramentas", re: /regador|mangueira|cortador de grama|poda|tesoura de poda|enxada|ancinho|p[aá] de jardim/i },
    { slug: "piscina-tratamento", label: "Piscina e Tratamento", re: /piscina|cloro|algicida|bomba de piscina|capa de piscina|tratamento de piscina/i },
  ],
  // --- Mercado ---
  supermercado: [
    { slug: "hortifruti", label: "Hortifruti", re: /fruta|verdura|legume|hortifruti|tomate|cebola|alho|batata|cenoura|alface|banana|ma[cç][aã]|laranja|ma[cç]a/i },
    { slug: "acougue-laticinios", label: "Açougue e Laticínios", re: /carne|frango|peixe|lingui[cç]a|queijo|manteiga|margarina|iogurte|requeij[aã]o|leite|presunto|mortadela|salame|presunto/i },
    { slug: "padaria-congelados", label: "Padaria e Congelados", re: /p[aã]o|pao|muffin|croissant|pizza|lasanha|empanado|nugget|hamb[uú]rguer|congelado/i },
    { slug: "limpeza-higiene", label: "Limpeza e Higiene", re: /detergente|sab[aã]o|[aá]gua sanit[aá]ria|papel higi[eê]nico|limpador|desinfetante|esponja|vassoura|rodo/i },
    { slug: "mercearia-seca", label: "Mercearia Seca", re: /arroz|feij[aã]o|a[cç][uú]car|sal|azeite|[oó]leo|massa|biscoito|farinha|amido|fub[aá]|aveia|cereal|conserva|atum|sardinha|palmito|milho|ervilha/i },
  ],
  mercearia: [
    { slug: "cafe", label: "Café", re: /caf[eé]|caf[eé] torrado|caf[eé] mo[ií]do|caf[eé] em c[aá]psula|caf[eé] em gr[aã]o|caf[eé] sol[uú]vel|caf[eé] expresso|caf[eé] coado|caf[eé] v60|caf[eé] french press|caf[eé] aeropress|caf[eé] cold|caf[eé] gelado|caf[eé] frapp[eé]|caf[eé] frappe|caf[eé] latte|caf[eé] cappuccino|caf[eé] macchiato|caf[eé] espresso|caf[eé] ristretto|caf[eé] lungo|caf[eé] doppio|caf[eé] americano|caf[eé] mocha|caf[eé] flat white|caf[eé] cortado|caf[eé] pingado|caf[eé] carioca|caf[eé] mineiro|caf[eé] paulista|caf[eé] fluminense/i },
    { slug: "massas-graos", label: "Massas e Grãos", re: /arroz|feij[aã]o|massa|farinha|fub[aá]|amido|aveia|muesli|cereais|mingau|granola/i },
    { slug: "doces-snacks", label: "Doces e Snacks", re: /chocolate|bala|docinho|bombom|pirulito|chiclete|snack|pipoca|castanha|doce|geleia|mel|goma de mascar|droga|rem[eé]dio caseiro/i },
    { slug: "laticinios", label: "Laticínios", re: /leite|manteiga|margarina|requeij[aã]o|requeijao|iogurte|queijo/i },
    { slug: "conservas", label: "Conservas", re: /conserva|atum|sardinha|palmito|milho|ervilha|vagem|nhoque|ravioli|sorvete|picol[eé]/i },
  ],
  "alimentos-bebidas": [
    { slug: "cervejas", label: "Cervejas", re: /cerveja|chopp|pilsen|ipa|stout|craft|cerveja artesanal/i },
    { slug: "vinhos-licores", label: "Vinhos e Licores", re: /vinho|espumante|licor|destilado|whisky|vodka|gin|rum|cacha[cç]a|tequila|champagne|prosecco|sake|saqu[eê]|bourbon|scotch|mezcal|raicilla|sotol|bacanora|agave|vinho tinto/i },
    { slug: "refrigerantes-sucos", label: "Refrigerantes e Sucos", re: /refrigerante|suco|energ[eé]tico|[aá]gua|cerveja artesanal|kit churrasco|espumante|destilado|licor|rum|cacha[cç]a|tequila|champagne|prosecco|sake|saqu[eê]|bourbon|scotch|mezcal|raicilla|sotol|bacanora|agave/i },
    { slug: "kits-churrasco", label: "Kits Churrasco", re: /kit churrasco|churrasco|espeto|grelha|carv[aã]o|carvao|g[aá]s de cozinha|g[aá]s glp|g[aá]s p13|g[aá]s p45|g[aá]s industrial|g[aá]s medicinal|g[aá]s butano|g[aá]s propano|g[aá]s natural|g[aá]s lp/i },
  ],
  "limpeza-higiene": [
    { slug: "limpeza-casa", label: "Limpeza da Casa", re: /detergente|sab[aã]o em p[oó]|[aá]gua sanit[aá]ria|alvejante|desinfetante|multiuso|limpador|desengordurante|amaciante|lava lou[cç]as|saco de lixo|vassoura|rodo/i },
    { slug: "higiene-pessoal", label: "Higiene Pessoal", re: /papel higi[eê]nico|sabonete|shampoo|desodorante|absorvente|fralda|higiene|higi[eê]nico|wipes|esponja|pano/i },
    { slug: "descartaveis", label: "Descartáveis", re: /papel toalha|guardanapo|copo descart[aá]vel|prato descart[aá]vel|len[cç]o umedecido|algod[aã]o|algod[aã]o hidrófilo|saco de lixo/i },
  ],
  pets: [
    { slug: "cachorro", label: "Cachorro", re: /cachorro|c[aã]o|cao|racao cachorro|coleira|passeio para c[aã]o|areia para gato|arranhador/i },
    { slug: "gato", label: "Gato", re: /gato|areia para gato|arranhador|gato/i },
    { slug: "aquario", label: "Aquário", re: /aqu[aá]rio|aquario|filtro|aerador|termometro|termostato|ilumina[cç][aã]o|alga|antialga|peixe/i },
    { slug: "higiene-racao", label: "Higiene e Ração", re: /shampoo|condicionador|banho|higiene|escova|pente|corte|unha|orelha|olho|dente|boca|gengiva|periodontal|t[aá]rtaro|placa|bacteria|fungo|parasita|verme|carrapato|pulga|piolho|[aá]caro|petisco|racao|guia|peitoral|cinto|transportadora|gaiola|cama para pet|brinquedo para pet|tosa|veterin[aá]rio/i },
  ],
  // --- Outros ---
  papelaria: [
    { slug: "cadernos-blocos", label: "Cadernos e Blocos", re: /caderno|bloco|agenda|planner|caderno inteligente|sketchbook/i },
    { slug: "canetas-material", label: "Canetas e Material", re: /caneta|marca-texto|lapiseira|borracha|apontador|corretivo|regua|tesoura|cola branca|silicone escolar/i },
    { slug: "mochilas-estojos", label: "Mochilas e Estojos", re: /mochila|estojo|lancheira|pasta|mala direta|mochila escolar|lancheira escolar/i },
    { slug: "papel", label: "Papel", re: /papel|sulfite|offset|cartaz|pardo|kraft|seda|photocopy|papelaria/i },
  ],
  brinquedos: [
    { slug: "action-figures", label: "Action Figures", re: /action figure|boneco|barbie|funko|pop vinyl|bobblehead|lol|baby alive|nerf|hot wheels|figura de a[cç][aã]o/i },
    { slug: "jogos-tabuleiro", label: "Jogos de Tabuleiro", re: /jogo de tabuleiro|jogos de tabuleiro|bingo|ludo|domin[oó]|domino|baralho|uno\b|trivial|impostor|catan|roleta/i },
    { slug: "pelucia", label: "Pelúcias", re: /pel[uú]cia|pel[uú]cias|pelucia/i },
    { slug: "educativos", label: "Educativos", re: /brinquedo educativo|blocos|montessori|jogo educativo|puzzle|quebra-cabe[cç]a|slime|massinha|lego|playmobil|imaginext|pokemon|yu-gi-oh|trading card|chaveiro/i },
  ],
  viagem: [
    { slug: "malas-bagagem", label: "Malas e Bagagem", re: /mala|mochila de viagem|bagagem|necessaire|mala de m[aã]o|mala carry on|mala de viagem/i },
    { slug: "hospedagem-passagens", label: "Hospedagem e Passagens", re: /passagem|hotel|pacote|resort|cruzeiro|airbnb|pousada/i },
    { slug: "acessorios-viagem", label: "Acessórios", re: /necessaire|adaptador|capa de assento|travesseiro de pesco[cç]o|organizador de mala|cadeado|etiqueta de mala|necessaire de viagem/i },
  ],
  eventos: [
    { slug: "shows-festas", label: "Shows e Festas", re: /ingresso para show|show|festival|festa|ingresso|ingressos/i },
    { slug: "cinema-teatro", label: "Cinema e Teatro", re: /cinema|teatro|sess[aã]o|filme|estreia|com[eé]dia|stand up/i },
    { slug: "congressos-cursos", label: "Congressos e Cursos", re: /congresso|workshop|palestra|curso|evento online|confer[eê]ncia|semin[aá]rio|evento/i },
  ],
  servicos: [
    { slug: "assinaturas-digitais", label: "Assinaturas Digitais", re: /assinatura|plano|streaming|netflix|spotify|amazon prime|hbo|disney|assinatura digital/i },
    { slug: "cursos-educacao", label: "Cursos e Educação", re: /curso|aula|mentoria|capacita[cç][aã]o|treinamento|e-book|livro digital|template|pack/i },
    { slug: "consultorias-servicos", label: "Consultorias e Serviços", re: /consultoria|assessoria|servi[cç]o|servico|assist[eê]ncia|assistencia/i },
  ],
  bebe: [
    { slug: "fraldas-higiene", label: "Fraldas e Higiene", re: /fralda|fraldas|absorvente|pomada assadura|len[cç]o umedecido|higiene beb[eê]|higi[eê]nico/i },
    { slug: "alimentacao-bebe", label: "Alimentação", re: /mamadeira|chupeta|babador|bab[aá] eletr[oô]nica|papinha|f[oó]rmula|formula|leite em p[oó]/i },
    { slug: "mobilidade-bebe", label: "Mobilidade e Sono", re: /ber[cç]o|berco|mois[eé]s|andador|sling|carrinho de beb[eê]|bebe comfort|balan[cç]o|cadeira de balan[cç]o|playground|cercadinho|cercado|tapete para beb[eê]|redinha/i },
    { slug: "banho-cuidado", label: "Banho e Cuidado", re: /banheira|shampoo baby|creme baby|higiene|toalha baby|esterilizador|esterilizadora|bico anti-?c[oó]lica|tetina/i },
  ],
};

export function subtypesFor(category: string | null | undefined): SubtypeDef[] {
  if (!category) return [];
  return SUBTYPES[norm(category)] ?? [];
}

export function resolveSubtype(
  category: string | null | undefined,
  title: string | null | undefined,
): string | null {
  const defs = subtypesFor(category);
  if (!defs.length || !title) return null;
  for (const d of defs) if (d.re.test(title)) return d.slug;
  return null;
}

export function subtypeLabel(category: string, slug: string): string {
  return subtypesFor(category).find((d) => d.slug === slug)?.label ?? slug;
}

// Resolve uma categoria de origem para a canonica; se desconhecida,
// tenta classificar pelo titulo; fallback "outros".
// A classificação por titulo vem PRIMEIRO para refinar categorias
// amplas da fonte em filhas especificas.
export function resolveCategory(raw: string | undefined | null, title?: string): string {
  if (title) {
    for (const [re, slug] of KEYWORDS) {
      if (re.test(title)) return slug;
    }
  }
  if (raw) {
    const key = norm(raw);
    if (ALIAS[key]) return ALIAS[key];
    if (CATEGORY_LABEL[key]) return key;
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
