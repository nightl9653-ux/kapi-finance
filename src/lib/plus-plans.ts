/** Plus 会员方案（Checkout 外链 + webhook 入账 `profiles.is_plus_member` / `plus_expires_at`） */

export type PlusPlanId = "monthly" | "quarterly" | "yearly" | "lifetime";

export type PlusPlanDefinition = {
  id: PlusPlanId;
  checkoutUrlEnv: string;
  /** 时长（月）；null = 终身 */
  durationMonths: number | null;
};

export const PLUS_PLANS: Record<PlusPlanId, PlusPlanDefinition> = {
  monthly: { id: "monthly", checkoutUrlEnv: "PLUS_PLAN_MONTHLY_CHECKOUT_URL", durationMonths: 1 },
  quarterly: { id: "quarterly", checkoutUrlEnv: "PLUS_PLAN_QUARTERLY_CHECKOUT_URL", durationMonths: 3 },
  yearly: { id: "yearly", checkoutUrlEnv: "PLUS_PLAN_YEARLY_CHECKOUT_URL", durationMonths: 12 },
  lifetime: { id: "lifetime", checkoutUrlEnv: "PLUS_PLAN_LIFETIME_CHECKOUT_URL", durationMonths: null },
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

/** 从起点起按方案加时长；终身返回 null */
export function addPlusPlanDuration(from: Date, planId: PlusPlanId): Date | null {
  const plan = getPlusPlan(planId);
  if (!plan || plan.durationMonths == null) return null;
  const next = new Date(from.getTime());
  next.setUTCMonth(next.getUTCMonth() + plan.durationMonths);
  return next;
}
