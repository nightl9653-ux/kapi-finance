export type Cadence = "daily" | "monthly" | "quarterly" | "yearly";

export type RecurringBillRow = {
  id: string;
  user_id: string;
  amount: number;
  currency?: string | null;
  fx_rate?: number | null;
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

/** 规则金额折合 USD（有 fx_rate 用原币×汇率，否则按原币当作 USD） */
export function amountTowardUsd(row: Pick<RecurringBillRow, "amount" | "currency" | "fx_rate">): number {
  const amount = Number(row.amount);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const cur = String(row.currency ?? "USD").toUpperCase();
  if (cur === "USD") return amount;
  const rate = Number(row.fx_rate);
  if (Number.isFinite(rate) && rate > 0) return Math.round(amount * rate * 100) / 100;
  return amount;
}

/**
 * 日历意义上「该月应出现的到期日」（忽略 last_generated_on，用于看板）。
 * 起算日取 max(规则 start, 月初)。
 */
export function calendarDueDatesInMonth(
  row: RecurringBillRow,
  year: number,
  month: number,
): string[] {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const monthStart = `${y}-${m}-01`;
  const dim = daysInMonth(year, month);
  const monthEnd = `${y}-${m}-${String(dim).padStart(2, "0")}`;
  if (row.end_date && row.end_date < monthStart) return [];
  const start = row.start_date ?? monthStart;
  if (start > monthEnd) return [];
  const begin = maxIso(start, monthStart);
  const limit = row.end_date && row.end_date < monthEnd ? row.end_date : monthEnd;
  return nextDueDates(
    {
      ...row,
      start_date: begin,
      last_generated_on: null,
    },
    limit,
  ).filter((d) => d >= monthStart && d <= monthEnd);
}

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

/** 用户对某一期点过「确认逾期」的到期日集合；表未迁移时返回空 */
export async function loadOverdueDueDates(params: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
  billIds?: string[];
}): Promise<Set<string>> {
  const key = (billId: string, dueOn: string) => `${billId}|${dueOn}`;
  let query = params.supabase
    .from("recurring_occurrence_overdue")
    .select("recurring_bill_id,due_on")
    .eq("user_id", params.userId);
  if (params.billIds?.length) {
    query = query.in("recurring_bill_id", params.billIds);
  }
  const { data, error } = await query;
  if (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "PGRST205" || /recurring_occurrence_overdue|schema cache|does not exist/i.test(error.message ?? "")) {
      return new Set();
    }
    throw error;
  }
  const out = new Set<string>();
  for (const row of data ?? []) {
    const billId = String((row as { recurring_bill_id?: string }).recurring_bill_id ?? "");
    const dueOn = String((row as { due_on?: string }).due_on ?? "").slice(0, 10);
    if (billId && dueOn) out.add(key(billId, dueOn));
  }
  return out;
}

export function occurrenceOverdueKey(billId: string, dueOn: string): string {
  return `${billId}|${dueOn}`;
}

/**
 * 在用户打开记账页时，自动把到期的周期账单“落地”为 transactions。
 * 某一期若已被用户确认逾期，则跳过入账，但仍推进 last_generated_on，避免反复重试。
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

  const overdueKeys = await loadOverdueDueDates({
    supabase: params.supabase,
    userId: params.userId,
    billIds: rows.map((r) => r.id),
  });

  for (const r of rows) {
    const start = r.start_date ?? upTo;
    const begin = r.last_generated_on ? addDays(r.last_generated_on, 1) : start;
    const effectiveBegin = maxIso(begin, start);
    const dates = nextDueDates({ ...r, start_date: effectiveBegin }, upTo);
    if (!dates.length) continue;

    const toInsert = dates.filter((iso) => !overdueKeys.has(occurrenceOverdueKey(r.id, iso)));

    if (toInsert.length) {
      const payload = toInsert.map((iso) => ({
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
    }

    // 推进游标：含被跳过的逾期期次，避免下回再捞同一天
    const last = dates[dates.length - 1]!;
    const { error: upErr } = await params.supabase
      .from("recurring_bills")
      .update({ last_generated_on: last })
      .eq("id", r.id)
      .eq("user_id", params.userId);
    if (upErr) throw upErr;
  }
}

/** 用户确认某一期逾期：记标记、删掉该期自动流水（若有）、必要时推进游标 */
export async function markRecurringOccurrenceOverdue(params: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
  billId: string;
  dueOn: string;
}): Promise<{ ok: true } | { ok: false; error: "invalid" | "not_found" | "schema_missing" | "failed"; detail?: string }> {
  const dueOn = params.dueOn.trim();
  if (!params.billId || !/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return { ok: false, error: "invalid" };

  const { data: bill, error: billErr } = await params.supabase
    .from("recurring_bills")
    .select("id,amount,type,category,last_generated_on")
    .eq("id", params.billId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (billErr) {
    return { ok: false, error: "failed", detail: billErr.message };
  }
  if (!bill) return { ok: false, error: "not_found" };

  const { error: markErr } = await params.supabase.from("recurring_occurrence_overdue").upsert(
    {
      user_id: params.userId,
      recurring_bill_id: params.billId,
      due_on: dueOn,
    },
    { onConflict: "recurring_bill_id,due_on" },
  );

  if (markErr) {
    const code = (markErr as { code?: string } | null)?.code;
    if (
      code === "PGRST205" ||
      /recurring_occurrence_overdue|schema cache|does not exist/i.test(markErr.message ?? "")
    ) {
      return { ok: false, error: "schema_missing", detail: markErr.message };
    }
    return { ok: false, error: "failed", detail: markErr.message };
  }

  // 取消该期已自动写入的流水
  await params.supabase
    .from("transactions")
    .delete()
    .eq("user_id", params.userId)
    .eq("occurred_on", dueOn)
    .eq("type", bill.type)
    .eq("category", bill.category)
    .eq("amount", bill.amount)
    .eq("is_auto_recorded", true);

  // 仅当该期已到期时推进游标，避免把未来日期提前「吃掉」
  const today = isoToday();
  const prev = bill.last_generated_on ? String(bill.last_generated_on).slice(0, 10) : null;
  if (dueOn <= today && (!prev || prev < dueOn)) {
    const { error: upErr } = await params.supabase
      .from("recurring_bills")
      .update({ last_generated_on: dueOn })
      .eq("id", params.billId)
      .eq("user_id", params.userId);
    if (upErr) return { ok: false, error: "failed", detail: upErr.message };
  }

  return { ok: true };
}

