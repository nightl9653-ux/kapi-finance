import type { SupabaseClient } from "@supabase/supabase-js";

/** monthFirstDay: `YYYY-MM-01`（与 budgets.month 一致） */
export function monthRangeUtc(monthFirstDay: string): { start: string; endExclusive: string } {
  const s = monthFirstDay.slice(0, 10);
  const [ys, ms] = s.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    const d = new Date();
    const yy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const fallback = `${yy}-${mm}-01`;
    return monthRangeUtc(fallback);
  }
  const start = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const endExclusive = `${String(nextY).padStart(4, "0")}-${String(nextM).padStart(2, "0")}-01`;
  return { start, endExclusive };
}

/** 本月支出：按 `transactions.category`（expense）汇总 amount_base */
export async function fetchExpenseTotalsByCategory(
  supabase: SupabaseClient,
  userId: string,
  monthFirstDay: string,
): Promise<Record<string, number>> {
  const { start, endExclusive } = monthRangeUtc(monthFirstDay);
  const { data, error } = await supabase
    .from("transactions")
    .select("category,amount_base")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("occurred_on", start)
    .lt("occurred_on", endExclusive)
    .limit(8000);

  if (error) throw error;

  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const cat = String((row as { category?: string }).category ?? "").trim() || "uncategorized";
    const amt = Number((row as { amount_base?: number | null }).amount_base ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    out[cat] = (out[cat] ?? 0) + amt;
  }
  return out;
}
