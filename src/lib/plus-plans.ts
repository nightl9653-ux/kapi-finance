/** Plus 会员方案（Checkout 外链 + webhook 入账 `profiles.is_plus_member`） */

export type PlusPlanId = "monthly" | "quarterly" | "yearly" | "lifetime";

export type PlusPlanDefinition = {
  id: PlusPlanId;
  checkoutUrlEnv: string;
};

export const PLUS_PLANS: Record<PlusPlanId, PlusPlanDefinition> = {
  monthly: { id: "monthly", checkoutUrlEnv: "PLUS_PLAN_MONTHLY_CHECKOUT_URL" },
  quarterly: { id: "quarterly", checkoutUrlEnv: "PLUS_PLAN_QUARTERLY_CHECKOUT_URL" },
  yearly: { id: "yearly", checkoutUrlEnv: "PLUS_PLAN_YEARLY_CHECKOUT_URL" },
  lifetime: { id: "lifetime", checkoutUrlEnv: "PLUS_PLAN_LIFETIME_CHECKOUT_URL" },
};

export const PLUS_PLAN_IDS = Object.keys(PLUS_PLANS) as PlusPlanId[];

export function getPlusPlan(id: string): PlusPlanDefinition | null {
  if (id in PLUS_PLANS) return PLUS_PLANS[id as PlusPlanId];
  return null;
}

export function getPlusPlanCheckoutUrl(plan: PlusPlanDefinition): string | null {
  const url = process.env[plan.checkoutUrlEnv]?.trim();
  return url || null;
}

export function isAnyPlusCheckoutConfigured(): boolean {
  return PLUS_PLAN_IDS.some((id) => Boolean(getPlusPlanCheckoutUrl(PLUS_PLANS[id])));
}
