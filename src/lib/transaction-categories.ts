/** 存入 `transactions.category` 的稳定键（便于 i18n 与统计）；自定义则为用户输入原文 */

export const EXPENSE_CATEGORY_KEYS = [
  "food",
  "transport",
  "housing",
  "shopping",
  "medical",
  "education",
  "entertainment",
  "social",
  "utilities",
  "other",
] as const;

export const INCOME_CATEGORY_KEYS = [
  "salary",
  "bonus",
  "investment",
  "business",
  "gift",
  "refund",
  "other",
] as const;

export const CATEGORY_CUSTOM = "__custom__";

export function isPresetForType(type: string, category: string): boolean {
  const ty = type === "income" ? "income" : "expense";
  const allowed = ty === "income" ? INCOME_CATEGORY_KEYS : EXPENSE_CATEGORY_KEYS;
  return (allowed as readonly string[]).includes(category);
}

/** 服务端：由 category_preset + category_custom 得到最终 category */
export function coerceTransactionCategory(type: string, preset: string, custom: string): string | null {
  const ty = type === "income" ? "income" : "expense";
  const p = String(preset ?? "").trim();
  const c = String(custom ?? "").trim();

  if (p === CATEGORY_CUSTOM || p === "__custom__") {
    return c.length > 0 ? c : null;
  }

  const allowed = ty === "income" ? INCOME_CATEGORY_KEYS : EXPENSE_CATEGORY_KEYS;
  if ((allowed as readonly string[]).includes(p)) return p;
  return null;
}

export function defaultPresetForType(type: string): string {
  return type === "income" ? INCOME_CATEGORY_KEYS[0] : EXPENSE_CATEGORY_KEYS[0];
}

export function parseCategoryUiState(
  stored: string | null | undefined,
  type: "expense" | "income",
): { preset: string; custom: string } {
  const s = String(stored ?? "").trim();
  if (!s) {
    return { preset: defaultPresetForType(type), custom: "" };
  }
  if (isPresetForType(type, s)) {
    return { preset: s, custom: "" };
  }
  return { preset: CATEGORY_CUSTOM, custom: s };
}

const PRESET_MSG: Record<string, string> = {
  food: "catFood",
  transport: "catTransport",
  housing: "catHousing",
  shopping: "catShopping",
  medical: "catMedical",
  education: "catEducation",
  entertainment: "catEntertainment",
  social: "catSocial",
  utilities: "catUtilities",
  salary: "catSalary",
  bonus: "catBonus",
  investment: "catInvestment",
  business: "catBusiness",
  gift: "catGift",
  refund: "catRefund",
};

/** 列表/详情展示用：预设键翻译，否则原文（历史自定义） */
export function formatCategoryLabel(
  stored: string | null | undefined,
  type: string | null | undefined,
  t: (key: string) => string,
): string {
  const s = String(stored ?? "").trim();
  if (!s) return "";
  const ty = type === "income" ? "income" : "expense";
  if (!isPresetForType(ty, s)) return s;
  if (s === "other") {
    return ty === "income" ? t("catIncomeOther") : t("catExpenseOther");
  }
  const id = PRESET_MSG[s];
  return id ? t(id) : s;
}
