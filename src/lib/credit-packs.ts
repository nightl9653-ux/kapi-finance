/** AI 文生图加量包（与支付平台 Product 映射；入账见 grantImageCreditsPack） */

export type CreditPackId = "images_20" | "hq_10";

export type CreditPackDefinition = {
  id: CreditPackId;
  displayPriceUsd: number;
  standardImages: number;
  hqImages: number;
  validDays: number;
  checkoutUrlEnv: string;
};

export const CREDIT_PACKS: Record<CreditPackId, CreditPackDefinition> = {
  images_20: {
    id: "images_20",
    displayPriceUsd: 2.99,
    standardImages: 20,
    hqImages: 0,
    validDays: 30,
    checkoutUrlEnv: "CREDIT_PACK_IMAGES_20_CHECKOUT_URL",
  },
  hq_10: {
    id: "hq_10",
    displayPriceUsd: 2.99,
    standardImages: 0,
    hqImages: 10,
    validDays: 30,
    checkoutUrlEnv: "CREDIT_PACK_HQ_10_CHECKOUT_URL",
  },
};

export const CREDIT_PACK_IDS = Object.keys(CREDIT_PACKS) as CreditPackId[];

export function getCreditPack(id: string): CreditPackDefinition | null {
  if (id in CREDIT_PACKS) return CREDIT_PACKS[id as CreditPackId];
  return null;
}

export function getCreditPackCheckoutUrl(pack: CreditPackDefinition): string | null {
  const url = process.env[pack.checkoutUrlEnv]?.trim();
  return url || null;
}
