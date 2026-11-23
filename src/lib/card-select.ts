import { Prisma } from "@prisma/client";

// Campos minimos que o ProductCard renderiza. Listagens devem SEMPRE
// usar este select: a linha completa tem `description` (HTML longo) e
// URLs de afiliado — fora do ar isso vira egress do Supabase a cada
// pageview (o pooler cobra por byte que sai do banco).
export const CARD_SELECT = {
  id: true,
  externalId: true,
  title: true,
  imageUrl: true,
  price: true,
  oldPrice: true,
  discountPct: true,
  currency: true,
  merchant: true,
  couponCode: true,
  endsAt: true,
} satisfies Prisma.ProductSelect;

export type CardProduct = Prisma.ProductGetPayload<{
  select: typeof CARD_SELECT;
}>;
