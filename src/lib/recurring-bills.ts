type Cadence = "daily" | "monthly" | "quarterly" | "yearly";

type RecurringBillRow = {
  id: string;
  user_id: string;
  amount: number;
  type: "expense" | "income";
  category: string;
  merchant: string | null;
  note: string | null;
  cadence: Cadence;
  month_of_year: number | null;
  day_of_month: number | null;
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD
  last_generated_on: string | null; // YYYY-MM-DD
};

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function ymdToParts(iso: string): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error("invalid_iso_date");
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function addMonths(iso: string, months: number): string {
  const { y, m, d } = ymdToParts(iso);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + months);
  return dt.toISOString().slice(0, 10);
}

function maxIso(a: string, b: string): string {
  return a >= b ? a : b;
}

function nextDueDates(row: RecurringBillRow, upTo: string): string[] {
  const start = row.start_date ?? isoToday();
  const end = row.end_date;
  const from = row.last_generated_on ? addMonths(row.last_generated_on, 0) : null;
  const begin = from ? addDays(from, 1) : start;

  const limit = end ? (end < upTo ? end : upTo) : upTo;
  if (begin > limit) return [];

  if (row.cadence === "daily") {
    const out: string[] = [];
    for (let cur = begin; cur <= limit; cur = addDays(cur, 1)) out.push(cur);
    return out;
  }

  const domRaw = row.day_of_month ?? 1;
  const dom = Math.min(28, Math.max(1, Math.floor(domRaw))); // 安全兜底：避免非法日期导致循环

  const out: string[] = [];

  if (row.cadence === "monthly") {
    // 从 begin 所在月开始滚动
    const { y, m } = ymdToParts(begin);
    let cursor = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
    while (cursor <= limit) {
      const { y: cy, m: cm } = ymdToParts(cursor);
      const dim = daysInMonth(cy, cm);
      const due = `${String(cy).padStart(4, "0")}-${String(cm).padStart(2, "0")}-${String(
        Math.min(dom, dim),
      ).padStart(2, "0")}`;
      if (due >= begin && due <= limit) out.push(due);
      cursor = addMonths(cursor, 1);
    }
    return out;
  }

  const monthRaw = row.month_of_year ?? 1;
  const month = Math.max(1, Math.min(12, Math.floor(monthRaw)));

  if (row.cadence === "yearly") {
    const { y: by } = ymdToParts(begin);
    let year = by;
    while (true) {
      const dim = daysInMonth(year, month);
      const due = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(
        Math.min(dom, dim),
      ).padStart(2, "0")}`;
      if (due > limit) break;
      if (due >= begin) out.push(due);
      year += 1;
    }
    return out;
  }

  // quarterly
  const step = 3;
  const { y: by, m: bm } = ymdToParts(begin);
  // 计算 begin 年里第一个 >= begin 的候选月份（month, month+3, ...）
  const candidates = [month, month + step, month + step * 2, month + step * 3].map((x) => ((x - 1) % 12) + 1);
  candidates.sort((a, b) => a - b);
  let year = by;
  let firstMonth = candidates.find((m) => m >= bm);
  if (!firstMonth) {
    year += 1;
    firstMonth = candidates[0]!;
  }
  let cursor = `${String(year).padStart(4, "0")}-${String(firstMonth).padStart(2, "0")}-01`;
  while (cursor <= limit) {
    const { y: cy, m: cm } = ymdToParts(cursor);
    const dim = daysInMonth(cy, cm);
    const due = `${String(cy).padStart(4, "0")}-${String(cm).padStart(2, "0")}-${String(
      Math.min(dom, dim),
    ).padStart(2, "0")}`;
    if (due >= begin && due <= limit) out.push(due);
    cursor = addMonths(cursor, step);
  }
  return out;
}

function addDays(iso: string, days: number): string {
  const { y, m, d } = ymdToParts(iso);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function isoToTimestampAt2000(iso: string): string {
  // 与 bulk create 的占位时刻保持一致（20:00）
  return new Date(`${iso}T20:00:00`).toISOString();
}

/**
 * 在用户打开记账页时，自动把到期的周期账单“落地”为 transactions。
 * 设计目标：无 cron 时也能逐步补齐，不重复生成。
 */
export async function materializeRecurringBills(params: {
  // 用宽类型避免 TS 在 build 时对 dynamic import 的解析差异
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
  upToDate?: string; // YYYY-MM-DD
}) {
  const upTo = params.upToDate ?? isoToday();

  const { data: rules, error } = await params.supabase
    .from("recurring_bills")
    .select(
      "id,user_id,amount,type,category,merchant,note,cadence,month_of_year,day_of_month,start_date,end_date,last_generated_on",
    )
    .eq("user_id", params.userId);

  // 若数据库尚未迁移该表（本地/新环境），直接降级：不生成周期账单，不阻断页面渲染。
  if (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "PGRST205") return;
    throw error;
  }
  const rows = (rules ?? []) as RecurringBillRow[];
  if (!rows.length) return;

  for (const r of rows) {
    const start = r.start_date ?? upTo;
    const begin = r.last_generated_on ? addDays(r.last_generated_on, 1) : start;
    const effectiveBegin = maxIso(begin, start);
    const dates = nextDueDates({ ...r, start_date: effectiveBegin }, upTo);
    if (!dates.length) continue;

    const payload = dates.map((iso) => ({
      user_id: params.userId,
      amount: r.amount,
      type: r.type,
      category: r.category,
      merchant: r.merchant,
      note: r.note,
      occurred_on: iso,
      timestamp: isoToTimestampAt2000(iso),
      is_auto_recorded: true,
    }));

    const { error: insErr } = await params.supabase.from("transactions").insert(payload);
    if (insErr) throw insErr;

    const last = dates[dates.length - 1]!;
    const { error: upErr } = await params.supabase
      .from("recurring_bills")
      .update({ last_generated_on: last })
      .eq("id", r.id)
      .eq("user_id", params.userId);
    if (upErr) throw upErr;
  }
}

