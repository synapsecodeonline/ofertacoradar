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
  [/\b(bagageiro|ba[uú]\s*(lateral|traseiro|givi|shad|monolock|top.?case|motocicleta)|ba[uú]leto|bauleto|alforje|top.?case|mala para moto|quebra vento|protetor de (motor|tanque|carenagem|quadro)|capa de moto|hitch|engate|reboque|macaco|tri[aâ]ngulo|estepe|calota|aba (de )?tanque|protetor de tanque)\b/i, "pecas-veiculos"],
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
  [/\b(adesivo|selante|resina|ep[oó]xi|loctite|silicone|cola|vedacit|desengripante|removedor|thinner|lubrificante|graxa|[oó]leo lubrificante|[oó]leo mineral|[oó]leo sintético|[oó]leo vegetal|[oó]leo de corte)\b/i, "quimica-industrial"],
  [/\b(parafuso|porca|arruela|rebite|grampo|abra[cç]adeira|barra roscada|chumbador|pino|trava|anel de vedação|bucha|cavilha|espiral|tirante|parafuso sextavado|porca sextada|flange|pino cônico|pino c[oô]nico|pino paralelo|pino el[aá]stico|pino r[ií]gido|pino de press[aã]o|pino de reten[cç][aã]o|anel de reten[cç][aã]o|anilha|arruela de press[aã]o|arruela lisa|arruela dentada|arruela grower|arruela de segurança|arruela de pressão|bloco padr[aã]o|bloco de a[cç]o|bloco em a[cç]o|arame|arame farpado|bloco em v|bloco magn[eé]tico)\b/i, "fixacao-metalica"],

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
  [/\b(cal[cç]a|pantalona|legging|saia|shorts|bermuda|macac[aã]o|jardineira|culotte|capri|flare|bootcut|mom jeans|wide leg|cargo|saruel|jeans|denim|cal[cç]as|saias|bermudas)\b/i, "calcas"],
  [/\b(blusa|blus[aã]o|camisa|camiseta|regata|cropped|moletom|hoodie|su[eé]ter|cardigan|jaqueta|casaco|parka|blazer|tricot|polera|polerinha|t[uú]nica|tunica|colete|corta vento|canguru|body (manga|de|para|gestante|longo|curto|fitness|academia|dança|dan[aç]a)|top (cropped|b[aá]sico|fitness|academia|yoga)|conjunto (feminino|masculino|infantil|i?ntimo|de banho|de praia|de academia|de gin[aá]stica|de yoga|de pilates|de corrida|de ciclismo|de trilha|de camping|de festa|de casamento)|blusas|camisas|camisetas|regatas|moletoms|hoodies|su[eé]teres|cardigans|jaquetas|casacos|parkas|blazers|tricots|poleras|polerinhas|t[uú]nicas|coletes|corta ventos|cangurus)\b/i, "blusas"],
  [/\b(suti[aã]|calcinha|lingerie|pijama|pijamas|conjunto i?ntimo|corset|cueca|bermuda i?ntima|short lingerie|top lingerie|suti[aã]s|calcinhas|lingeries|corsets|cuecas)\b/i, "lingerie"],
  [/\b(t[eê]nis|sapato|sand[aá]lia|sapat[eê]nis|scarpin|salto|rasteira|chinelo|papete|mocassim|loafer|oxford|dockside|sapatilha|tamanco|bota|coturno|botina|galocha|slipper|rasteirinha|cal[cç]ado|calcado|t[eê]nises?|sapatos?|sand[aá]lias?|sapat[eê]nises?|scarpins?|saltos?|rasteiras?|chinelos?|papetes?|mocassins?|loafers?|oxfords?|dockside|sapatilhas?|tamancos?|botas?|coturnos?|botinas?|galochas?|slippers?|rasteirinhas?|cal[cç]ados?)\b/i, "calcados"],
  [/\b(bolsa|mochila|pasta executiva|carteira|necessaire|pochete|riñonera|rinonera|crossbody|tiracolo|bolsas|mochilas|carteiras|necessaires|pochetes|riñoneras|rinoneras|pastas executivas|crossbodys|tiracolos)\b/i, "bolsas-mochilas"],
  [/\b(joia|semi joia|semi-joia|rel[oó]gio|relogio|ter[cç]o|ros[aá]rio|amuleto|medalha|escapul[aá]rio|imagem religiosa|pingente|berloque|colar de ouro|brinco de ouro|anel de ouro|pulseira de ouro|joias|semi joias|rel[oó]gios|relogios|ter[cç]os|ros[aá]rios|amuletos|medalhas|escapul[aá]rios|pingentes|berloques)\b/i, "joias-relogios"],
  [/\b(brinco|colar|pulseira|anel|piercing|tiara|presilha|grampos|amarrador de cabelo|scrunchie|cinto|chap[eé]u|bone|chapeu|riñonera|rinonera|tornozeleira|broche|bijuteria|adere[cç]o|adereco|acess[oó]rio|acessorio|brincos|colares|pulseiras|aneis|piercings|tiaras|presilhas|amarradores de cabelo|scrunchies|cintos|chap[eé]us|bones|chapeus|riñoneras|rinoneras|tornozeleiras|broches|bijuterias|adere[cç]os|aderecos|acess[oó]rios|acessorios|bon[eé]|bandana|gorro|meia|meias|len[cç]o|lenco|cachecol|viseira|headband)\b/i, "acessorios-moda"],
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
  [/\b(maquiagem|batom|base|r[ií]mel|delineador|esmalte|esfoliante|m[aá]scara de c[ií]lios|skincare|sabonete facial|[aá]cido hialur[oô]nico|vitamina c|serum|[aá]gua micelar|protetor solar|hidratante|condicionador|shampoo|finalizador|progressiva|escova modeladora|\bspa\b|massagem|harmoniza[cç][aã]o|depila[cç][aã]o|est[eé]tica)\b/i, "beleza"],

  // ===== Casa / eletro =====
  [/\b(ar.?condicionado|ar condicionado|split|ventilador|torre de ventila|aquecedor|climatizador|purificador de ar|umidificador|desumidificador|exaustor|circulador de ar|frio port[aá]til)\b/i, "climatizacao"],
  [/\b(air ?fryer|airfryer|fritadeira el[eé]trica|liquidificador|batedeira|cafeteira|micro.?ondas|cooktop|forno el[eé]trico|forno de embutir|panela de press[aã]o el[eé]trica|panela el[eé]trica|sorveteira|processador de alimentos|grill|sanduicheira|m[aá]quina de caf[eé]|m[aá]quina de espresso|nespresso|torradeira|juicer|extrator de suco|pipoqueira|churrasqueira el[eé]trica|grelhador|galeteira|panificadora|m[aá]quina de macarr[aã]o|chocolateira)\b/i, "eletro-cocina"],
  [/\b(aspirador|lava.?lou[cç]as|ferro de passar|ferro el[eé]trico|lava roupas|m[aá]quina de lavar|secadora de roupas|mop el[eé]trico|vassoura el[eé]trica|aspirador rob[oô]|robo aspirador|escova el[eé]trica|cortador de grama|m[aá]quina de costura|overlock|m[aá]quina de bordar|seladora a v[aá]cuo|umidificador)\b/i, "eletro-limpeza"],
  [/\b(lumin[aá]rias?|l[aâ]mpadas?|lustres?|arandelas?|spots?|plafons?|abajures?|fitas? de led|refletores?|painel de led|lumin[aá]ria de mesa|lumin[aá]ria de piso|lumin[aá]ria de teto|kit led|perfil de led|sensor de presen[cç]a|interruptor com sensor|dimmer|varais?|varal de ch[aã]o|tendedouros?)\b/i, "iluminacao"],
  [/\b(jogo de cama|len[cç][oó]is?|fronhas?|travesseiros?|edredons?|cobertores?|mantas?|toalha de banho|toalhas?|tapetes?|cortinas?|persianas?|almofadas?|jogos? americanos?|guardanapos?|ta[cç]as?|copos?|canecas?|pires?|bule|leiteiras?|a[cç][uú]careras?|porta tempero|porta talheres|cestos?|capa de mesa|jogo de toalha|organizadora de cozinha|organizadoras de cozinha|porta guardanapo|portas? retrato|boleira|individual|americanas)\b/i, "textil-cama"],
  [/\b(organizador|organizadora|prateleira|nicho|cesto organizador|caixa organizadora|sapateira|closet|porta chaves|porta documentos|caixa de ferramentas|maleta de ferramentas|mala de ferramentas|estojo de ferramentas)\b/i, "organizacao"],
  [/\b(sof[aá]s?|poltronas?|mesas? de (jantar|centro|lateral)|cama box|colch[oõ]es?|guarda-roupas?|arm[aá]rios?|c[oô]modas?|estantes?|racks?|painel para tv|painel para televis[aã]o|escrivaninhas?|cadeiras?|cadeira de escrit[oó]rio|cadeira gamer|sof[aá] retr[aá]til|puffs?|banquetas?|bancos?|balc[aã]o|aparador(es)?|bufet|buf[eê]|criados? mudo|cabeceiras?|ber[cç]os?|bercos?|mois[eé]s|bebe comfort|balan[cç]os?|cadeira de balan[cç]o|redinhas?|playgrounds?|cercadinhos?|cercados?|tapetes? para beb[eê]|carrinhos? de beb[eê]|a[eé]reo de canto|mesa de canto|aereo de canto)\b/i, "moveis"],
  [/\b(quadros?|vasos? decorativos?|terr[aá]rios?|enfeites?|decora[cç][aã]o|decorativos?|candlesticks?|lousas?|espelhos? decorativos?|quadros? decorativos?|telas? decorativas?|sanfonados?|cordas?|sininhos? decorativos?|cestinhas?|cestos? decorativos?|suporte para plantas|cachep[oô]s?|arranjos? florais?|flores? artificiais?|galhos? decorativos?|pedras? decorativas?|portas? retrato|arvore de natal|árvore de natal|pres[ée]pios?|bandeiras?|banderinhas?|crisantemos?|rosas?|girassois?|tulipas?|orqu[ií]deas?|astromelias?|margaridas?|cravos?|jasmim|lavandas?|hort[eê]nsias?|pe[oô]nias?|d[áa]lias?|l[ií]rios?|costela de ad[aã]o|suculentas?|cactos? artificiais?|painel decorativo|quadro decorativo)\b/i, "decoracao"],
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
  [/\b(paqu[ií]metro|micr[oô]metro|rel[oó]gio comparador|comparador|trena digital|mult[ií]metro|amper[ií]metro|volt[ií]metro|dinam[oô]metro|balan[cç]a de precis[aã]o|instrumento de medi[cç][aã]o|n[ií]vel digital|n[ií]vel a laser|n[ií]vel de bolha|anem[oô]metro|anemometro|watt[ií]metro|wattimetro|meg[oô]hmetro|megohmetro|alicate amper[ií]metro|medidor de (energia|vaz[aã]o|press[aã]o))\b/i, "medicao-precisao"],
  [/\b(tinta|tinta spray|pincel|rolo de pintura|verniz|massa corrida|selador|impermeabilizante|corante|tinta acr[ií]lica|tinta l[aá]tex|thinner|tinta ep[oó]xi|tinta poliuretano)\b/i, "tinta-pintura"],
  [/\b(tinta|pincel|rolo de pintura|massa corrida|selador|impermeabilizante|cimento|argamassa|telha|tijolo|drywall|gesso|verniz|resina ep[oó]xi)\b/i, "construcao"],
  [/\b(planta|vaso de planta|terra vegetal|semente|regador|mangueira|grama|adubo|rede de descanso|rede de dormir|cortador de grama|piscina)\b/i, "jardim"],
  [/\b(furadeira|parafusadeira|serra|chave de fenda|trena|n[ií]vel|betoneira|compressor|solda|ferramenta|jogo de chaves|alicate|martelo|lima|arquivos?|banco de trabalho|bancada|torno|fresa|broca|escareador|reamer|macho|tarraxa|cossinete|morsa|bigorna|marreta|amolador|chaira|esmeril|esmerilhadeira|ma[cç]arico|ma[cç]arico de corte|ma[cç]arico de solda|ma[cç]arico de corte plasma|ma[cç]arico de corte oxicorte|ma[cç]arico de solda mig|ma[cç]arico de solda tig|ma[cç]arico de solda eletrodo|ma[cç]arico de solda arco|biseladora|curvador de (tubo|cano)|desentupidor|bedame|a[cç]o r[aá]pido)\b/i, "ferramentas"],
  [/\b(instrumento musical|viol[aã]o|guitarra|teclado musical|microfone|caixa de som|mesa de som|interface de [aá]udio)\b/i, "eletronicos"],
  [/\b(ind[uú]stria|equipamento industrial|m[aá]quina industrial|componente eletr[oô]nico|placa de circuito|sensor|motor el[eé]trico|motor industrial|motor trif[aá]sico|motor monof[aá]sico|motor de indu[cç][aã]o|motor s[ií]ncrono|motor ass[ií]ncrono|motor de corrente contínua|motor de corrente alternada)\b/i, "industria"],

  // ===== Outros / genéricos =====
  [/\b(mala de viagem|mochila de viagem|mala de m[aã]o|bagagem|necessaire de viagem|passagem a[eé]rea|passagem aerea|hotel|pacote de viagem|resort|pousada|airbnb|cruzeiro)\b/i, "viagem"],
  [/\b(ingresso para show|show|festival|teatro|cinema|ingresso|ingressos|evento|evento online|congresso|workshop|stand up|com[eé]dia)\b/i, "eventos"],
  [/\b(instrumento musical|viol[aã]o|guitarra|teclado musical|microfone|caixa de som|mesa de som|interface de [aá]udio|violino|baixo|cajon|pandeiro|surdo|tamborim|reco-reco|agogo|tri[aâ]ngulo|cântaro)\b/i, "eletronicos"],
];

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
