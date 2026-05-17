import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchExpenseTotalsByCategory } from "@/lib/budget-progress";

function monthStartISO(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function startDateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - Math.max(1, Math.floor(days)));
  return d.toISOString().slice(0, 10);
}

type TxLite = { type: string | null; category: string | null; amount_base: number | null };

function summarizeExpenseByCategory(rows: TxLite[]) {
  const byCat: Record<string, number> = {};
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    const amt = Number(r.amount_base ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    const ty = String(r.type ?? "");
    if (ty === "income") income += amt;
    else if (ty === "expense") {
      expense += amt;
      const c = String(r.category ?? "").trim() || "uncategorized";
      byCat[c] = (byCat[c] ?? 0) + amt;
    }
  }
  const catPairs = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  return { income, expense, catPairs };
}

/**
 * 拼一段注入到 system prompt 的简要画像，减少「通用理财文章」式回复。
 */
export async function buildAssistantContextBlock(
  supabase: SupabaseClient,
  userId: string,
  locale: "zh" | "en",
): Promise<string> {
  const since = startDateDaysAgo(90);
  const month = monthStartISO();

  const [profileRes, goalsRes, budgetRes, txRes] = await Promise.all([
    supabase.from("profiles").select("monthly_income").eq("id", userId).maybeSingle(),
    supabase.from("financial_goals").select("name").eq("user_id", userId).limit(12),
    supabase.from("budgets").select("id").eq("user_id", userId).eq("month", month).maybeSingle(),
    supabase
      .from("transactions")
      .select("type,category,amount_base")
      .eq("user_id", userId)
      .gte("occurred_on", since)
      .limit(8000),
  ]);

  const hint = profileRes.data?.monthly_income != null ? Number(profileRes.data.monthly_income) : null;
  const monthlyIncome =
    hint != null && Number.isFinite(hint) && hint > 0 ? hint : null;

  const goalNames = (goalsRes.data ?? [])
    .map((g: { name?: string | null }) => String(g.name ?? "").trim())
    .filter(Boolean);

  const budgetId = budgetRes.data?.id != null ? String(budgetRes.data.id) : null;
  const hasBudget = Boolean(budgetId);

  let budgetLinesZh: string[] = [];
  let budgetLinesEn: string[] = [];

  if (budgetId) {
    try {
      const [itemsRes, spentMonth] = await Promise.all([
        supabase
          .from("budget_items")
          .select("category,limit_base,pct")
          .eq("budget_id", budgetId)
          .order("limit_base", { ascending: false })
          .limit(24),
        fetchExpenseTotalsByCategory(supabase, userId, month),
      ]);

      const rows = itemsRes.data ?? [];
      for (const row of rows.slice(0, 20)) {
        const cat = String((row as { category?: string }).category ?? "").trim() || "uncategorized";
        const cap = Number((row as { limit_base?: number }).limit_base ?? 0);
        const pct = (row as { pct?: number | null }).pct;
        const used = spentMonth[cat] ?? 0;
        const capStr = Number.isFinite(cap) ? cap.toFixed(0) : "0";
        const usedStr = Number.isFinite(used) ? used.toFixed(0) : "0";
        const pctStr =
          pct != null && Number.isFinite(Number(pct)) ? `（占预算总额 ${Number(pct).toFixed(1)}%）` : "";
        budgetLinesZh.push(`  · ${cat}：上限 ${capStr} USD，本月已记支出 ${usedStr} USD${pctStr}`);
        budgetLinesEn.push(
          `  · ${cat}: cap ${capStr} USD, spent this month ${usedStr} USD${pct != null && Number.isFinite(Number(pct)) ? ` (${Number(pct).toFixed(1)}% of total caps)` : ""}`,
        );
      }
      if (budgetLinesZh.length === 0) {
        budgetLinesZh.push("  · （本月有预算记录但暂无分行明细）");
        budgetLinesEn.push("  · (budget exists but no line items returned)");
      }
    } catch {
      budgetLinesZh = ["  · （读取预算分行失败，回答时不要编造数字）"];
      budgetLinesEn = ["  · (could not load budget lines—do not invent numbers)"];
    }
  }

  const { income, expense, catPairs } = summarizeExpenseByCategory((txRes.data ?? []) as TxLite[]);
  const top3 = catPairs.slice(0, 3);

  if (locale === "zh") {
    const lines = [
      "【咔皮已知的简要画像（来自应用内真实汇总，用于把建议说具体；禁止编造下面未出现的事实；金额为 USD 本位，仅作量级参考）】",
      `- 资料「月收入」：${monthlyIncome != null ? `约 ${monthlyIncome.toFixed(0)} USD` : "未填写"}`,
      `- 财务目标：${goalNames.length ? `${goalNames.slice(0, 6).join("、")}（共 ${goalNames.length} 个）` : "尚未创建"}`,
      `- 本月是否已有 AI 预算方案：${hasBudget ? "是" : "否"}`,
      ...(hasBudget && budgetLinesZh.length
        ? [
            `- 本月预算各行（上限 vs 本月已记支出；分类名须与记账 category 一致才会汇总「已记」）：`,
            ...budgetLinesZh,
          ]
        : []),
      `- 近 90 天汇总：收入约 ${income.toFixed(0)} USD，支出约 ${expense.toFixed(0)} USD`,
      top3.length > 0
        ? `- 近 90 天支出较多的分类（前 3）：${top3.map(([c, a]) => `${c} ${a.toFixed(0)}`).join("；")}`
        : `- 近 90 天几乎没有可统计的支出分类记录`,
    ];
    return lines.join("\n");
  }

  const lines = [
    "[Kapi snapshot from this user's data—personalize but never invent facts not listed; amounts are USD base, approximate.]",
    `- Profile monthly income hint: ${monthlyIncome != null ? `~${monthlyIncome.toFixed(0)} USD` : "not set"}`,
    `- Financial goals: ${goalNames.length ? `${goalNames.slice(0, 6).join(", ")} (${goalNames.length} total)` : "none yet"}`,
    `- AI budget plan for this calendar month: ${hasBudget ? "yes" : "no"}`,
    ...(hasBudget && budgetLinesEn.length
      ? [`- This month's budget lines (cap vs spent this month; "spent" matches transaction category exactly):`, ...budgetLinesEn]
      : []),
    `- Last ~90d totals: income ~${income.toFixed(0)} USD, expenses ~${expense.toFixed(0)} USD`,
    top3.length > 0
      ? `- Top 3 expense categories (~90d): ${top3.map(([c, a]) => `${c} ${a.toFixed(0)}`).join("; ")}`
      : `- Little categorized expense data in the last ~90d`,
  ];
  return lines.join("\n");
}
