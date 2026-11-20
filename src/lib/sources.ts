// Fonte de afiliado de um item, derivada do prefixo de externalId.
// camp-lomadee:/prod-lomadee: = Lomadee | ml: = Mercado Livre | aw: = Awin | amz: = Amazon
export type SourceKey = "lomadee" | "ml" | "awin" | "amazon";

export function sourceKeyOf(
  externalId?: string | null,
): SourceKey | null {
  if (!externalId) return null;
  if (
    externalId.startsWith("camp-lomadee:") ||
    externalId.startsWith("prod-lomadee:")
  )
    return "lomadee";
  if (externalId.startsWith("ml:")) return "ml";
  if (externalId.startsWith("aw:")) return "awin";
  if (externalId.startsWith("amz:")) return "amazon";
  return null;
}

export const SOURCE_LABEL: Record<SourceKey, string> = {
  lomadee: "Lomadee",
  ml: "Mercado Livre",
  awin: "Awin",
  amazon: "Amazon",
};

export const SOURCE_BADGE: Record<SourceKey, string> = {
  lomadee: "bg-emerald-600 text-white",
  ml: "bg-sky-600 text-white",
  awin: "bg-violet-600 text-white",
  amazon: "bg-orange-500 text-white",
};

// Prefixos de catalogo por fonte (produtos; ofertas Lomadee usam camp-lomadee:)
export const SOURCE_PREFIX: Record<SourceKey, string> = {
  lomadee: "prod-lomadee:",
  ml: "ml:",
  awin: "aw:",
  amazon: "amz:",
};

export const ALL_SOURCES: SourceKey[] = ["lomadee", "ml", "awin", "amazon"];

export function sourceBadgeOf(externalId?: string | null) {
  const key = sourceKeyOf(externalId);
  return key ? { label: SOURCE_LABEL[key], className: SOURCE_BADGE[key] } : null;
}
