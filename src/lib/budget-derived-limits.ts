/**
 * Derives savings / emergency_fund budget lines from monthly income & expense estimates
 * (profile monthly income or 90d income / 3, minus 90d expense / 3).
 */

export type MonthlyDerivedMetrics = {
  monthlyIncome: number;
  monthlyExpense: number;
  surplus: number;
};

export function computeMonthlyDerivedMetrics(params: {
  income90: number;
  expense90: number;
  monthlyIncomeHint: number | null;
}): MonthlyDerivedMetrics {
  const income90 = Number.isFinite(params.income90) ? params.income90 : 0;
  const expense90 = Number.isFinite(params.expense90) ? params.expense90 : 0;

  const monthlyIncome =
    params.monthlyIncomeHint != null &&
    Number.isFinite(params.monthlyIncomeHint) &&
    params.monthlyIncomeHint > 0
      ? roundMoney(params.monthlyIncomeHint)
      : roundMoney(income90 / 3);

  const monthlyExpense = roundMoney(expense90 / 3);
  const surplus = roundMoney(Math.max(0, monthlyIncome - monthlyExpense));

  return { monthlyIncome, monthlyExpense, surplus };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Maps AI category labels to derived buckets. */
export function bucketDerivedCategory(raw: string): "savings" | "emergency" | null {
  const n = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (n === "savings" || n === "saving") return "savings";
  if (n === "emergency_fund" || n === "emergencyfund") return "emergency";
  return null;
}

type ItemLike = {
  category: string;
  limit_base: number;
  pct?: number | null;
  rationale?: string | null;
};

/**
 * Overwrites limit_base (and rationale) for savings / emergency_fund rows when present.
 * If both appear, surplus is split 80% savings / 20% emergency (remainder goes to savings).
 */
export function applyDerivedSavingsEmergencyLimits<T extends ItemLike>(
  items: T[],
  metrics: MonthlyDerivedMetrics,
  locale: "zh" | "en",
): T[] {
  let hasSavings = false;
  let hasEmergency = false;
  for (const it of items) {
    const b = bucketDerivedCategory(it.category);
    if (b === "savings") hasSavings = true;
    if (b === "emergency") hasEmergency = true;
  }
  if (!hasSavings && !hasEmergency) return items;

  const { surplus } = metrics;
  let savingsAmt = 0;
  let emergencyAmt = 0;

  if (hasSavings && hasEmergency) {
    emergencyAmt = roundMoney(surplus * 0.2);
    savingsAmt = roundMoney(surplus - emergencyAmt);
  } else if (hasSavings) {
    savingsAmt = surplus;
  } else {
    emergencyAmt = surplus;
  }

  const rationaleSavings =
    locale === "zh"
      ? hasEmergency
        ? "由月收入估算减月支出估算得到结余；本品目取结余的 80%。月收入优先取资料「月收入」，否则为近90天收入÷3；月支出为近90天支出÷3。"
        : "由月收入估算减月支出估算得到本月建议储蓄额度。月收入优先取资料「月收入」，否则为近90天收入÷3；月支出为近90天支出÷3。"
      : hasEmergency
        ? "Surplus = estimated monthly income minus estimated monthly expense; this line is 80% of surplus. Income uses profile hint when set, else 90d income÷3; expense uses 90d expense÷3."
        : "Suggested monthly savings = max(0, estimated monthly income − estimated monthly expense). Income uses profile hint when set, else 90d income÷3; expense uses 90d expense÷3.";

  const rationaleEmergency =
    locale === "zh"
      ? hasSavings
        ? "由月收入估算减月支出估算得到结余；本品目取结余的 20%。月收入与月支出估算规则同储蓄行。"
        : "由月收入估算减月支出估算得到本月建议应急金预留。月收入优先取资料「月收入」，否则为近90天收入÷3；月支出为近90天支出÷3。"
      : hasSavings
        ? "Surplus split: this line is 20% of surplus (same income/expense estimates as savings)."
        : "Suggested monthly emergency fund allocation from the same surplus formula (income/expense estimates as in docs).";

  return items.map((it) => {
    const b = bucketDerivedCategory(it.category);
    if (b === "savings") {
      return { ...it, limit_base: savingsAmt, rationale: rationaleSavings };
    }
    if (b === "emergency") {
      return { ...it, limit_base: emergencyAmt, rationale: rationaleEmergency };
    }
    return it;
  });
}

/** Recompute pct as share of total limits (for display). */
export function recalculateBudgetItemPct<T extends ItemLike>(items: T[]): T[] {
  const total = items.reduce((acc, it) => {
    const v = Number(it.limit_base);
    return acc + (Number.isFinite(v) && v >= 0 ? v : 0);
  }, 0);

  if (total <= 0) {
    return items.map((it) => ({ ...it, pct: null }));
  }

  return items.map((it) => {
    const v = Number(it.limit_base);
    const lim = Number.isFinite(v) && v >= 0 ? v : 0;
    return { ...it, pct: Math.round((lim / total) * 1000) / 10 };
  });
}
