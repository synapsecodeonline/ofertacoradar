// Marcas que o publico brasileiro reconhece — usadas no boost do kit
// diario e na extracao de g:brand do feed Google Shopping.
export const KNOWN_BRANDS = new RegExp(
  "\\b(" +
    [
      // tech
      "samsung", "apple", "iphone", "ipad", "macbook", "airpods", "motorola",
      "xiaomi", "redmi", "poco", "realme", "nokia", "intelbras", "positivo",
      "sony", "jbl", "philips", "logitech", "razer", "hyperx", "redragon",
      "canon", "nikon", "gopro", "dji", "anker", "baseus", "ugreen", "elgato",
      // games
      "nintendo", "switch", "playstation", "ps5", "ps4", "xbox", "steam",
      // esporte
      "nike", "adidas", "puma", "fila", "mizuno", "asics", "olympikus",
      "lacoste", "hurley", "quicksilver", "oakley", "vans", "converse",
      "new balance", "kappa", "umbro", "topper", "diadora", "skechers",
      "under armour", "havaianas", "ipanema", "melissa", "rider",
      // casa/eletro
      "braun", "elgin", "britania", "continental", "tramontina",
      "lavo", "oxford", "midea", "consul", "brastemp", "electrolux", "arno",
      "oster", "philco", "euro", "lorenzetti", "docol", "hydra", "fischer",
      "multilaser", "tcl", "aoc", "lenovo", "dell", "acer",
      // moda/varejo
      "renner", "riachuelo", "c&a", "marisa", "forever 21", "zara",
      "lee", "wrangler", "timberland", "champion", "cea", "mormaii",
      "colcci", "animale", "doktor", "aramis", "hering",
      // beleza
      "natura", "avon", "boticario", "eudora", "quem disse berenice",
      "dailus", "marcelo", "lancaster", "olay", "nivea", "dove", "seda",
      "pantene", "johnson", "needs", "viella", "vult", "bruna tavares",
      "haskell", "vizzela", "ambiderm", "golde",
      // alimentacao/bebidas
      "heineken", "skol", "brahma", "antartica", "guarana", "itambe",
      "parmalat", "nestle", "danone", "coca", "pepsi", "del valle",
      "tang", "fanta", "sprite", "mineirinho", "aquarius", "gatorade",
      "monster", "red bull", "tnt", "fusion", "integralmedica",
      // pets
      "pedigree", "whiskas", "friskies", "purina", "royal canin",
      "premier", "catier", "nobit",
      // bebe
      "pampers", "huggies", "tommee", "chicco", "philips avent",
    ].join("|") +
    ")\\b",
  "i",
);

// Extrai a marca do titulo quando reconhecivel; null caso contrario.
export function brandFromTitle(title: string): string | null {
  const m = title.match(KNOWN_BRANDS);
  return m ? m[1] : null;
}
