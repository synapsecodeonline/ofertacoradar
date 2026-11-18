import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  FEATURED_STORES,
  storeLogo,
  type FeaturedStore,
} from "@/lib/featured-stores";

const featuredByMerchant = new Map(
  FEATURED_STORES.map((s) => [s.merchant.toLowerCase(), s]),
);

export function featuredStoreFor(merchant: string): FeaturedStore {
  return featuredByMerchant.get(merchant.toLowerCase()) ?? { merchant };
}

// Uma query por request (dedup via React cache) — usada pelos cards de produto
export const getBrandLogoMap = cache(async () => {
  const brands = await prisma.brand.findMany({
    select: { name: true, logo: true },
  });
  return new Map(brands.map((b) => [b.name ?? "", b.logo] as const));
});

export async function merchantLogo(
  merchant: string | null | undefined,
): Promise<string | null> {
  if (!merchant) return null;
  return storeLogo(featuredStoreFor(merchant), await getBrandLogoMap());
}
