import type { RecurringBillRow } from "@/lib/recurring-bills";
import {
  amountTowardUsd,
  calendarDueDatesInMonth,
  occurrenceOverdueKey,
} from "@/lib/recurring-bills";

export type FixedCostStatus = "posted" | "markedOverdue" | "overdue" | "dueToday" | "upcoming";

export type FixedCostOccurrence = {
  billId: string;
  type: "expense" | "income";
  category: string;
  note: string | null;
  merchant: string | null;
  cadence: RecurringBillRow["cadence"];
  dueOn: string;
  amount: number;
  currency: string;
  amountUsd: number;
  status: FixedCostStatus;
  /** 可点「确认逾期」：尚未被用户标逾期 */
  canMarkOverdue: boolean;
};

export type FixedCostBoard = {
  year: number;
  month: number;
  monthLabel: string;
  expensePlannedUsd: number;
  expensePostedUsd: number;
  expensePendingUsd: number;
  expenseOverdueUsd: number;
  expenseMarkedOverdueUsd: number;
  incomePlannedUsd: number;
  incomePostedUsd: number;
  occurrences: FixedCostOccurrence[];
};

function statusFor(params: {
  dueOn: string;
  lastGeneratedOn: string | null;
  today: string;
  userMarkedOverdue: boolean;
}): FixedCostStatus {
  if (params.userMarkedOverdue) return "markedOverdue";
  // 已推进游标且未被标逾期 → 视为已自动入账
  const posted = Boolean(params.lastGeneratedOn && params.lastGeneratedOn >= params.dueOn);
  if (posted) return "posted";
  if (params.dueOn < params.today) return "overdue";
  if (params.dueOn === params.today) return "dueToday";
  return "upcoming";
}

/** 由周期账单规则 + 用户逾期标记生成本月看板 */
export function buildFixedCostBoard(params: {
  bills: RecurringBillRow[];
  /** billId|dueOn */
  overdueKeys: Set<string>;
  year: number;
  month: number; // 1–12
  today?: string;
  locale?: "zh" | "en";
}): FixedCostBoard {
  const today = params.today ?? new Date().toISOString().slice(0, 10);
  const locale = params.locale === "zh" ? "zh" : "en";
  const monthLabel = new Date(Date.UTC(params.year, params.month - 1, 1)).toLocaleDateString(
    locale === "zh" ? "zh-CN" : "en-US",
    { year: "numeric", month: "long", timeZone: "UTC" },
  );

  const occurrences: FixedCostOccurrence[] = [];

  for (const bill of params.bills) {
    const dues = calendarDueDatesInMonth(bill, params.year, params.month);
    const amountUsd = amountTowardUsd(bill);
    for (const dueOn of dues) {
      const userMarkedOverdue = params.overdueKeys.has(occurrenceOverdueKey(bill.id, dueOn));
      const status = statusFor({
        dueOn,
        lastGeneratedOn: bill.last_generated_on,
        today,
        userMarkedOverdue,
      });
      occurrences.push({
        billId: bill.id,
        type: bill.type,
        category: bill.category,
        note: bill.note,
        merchant: bill.merchant,
        cadence: bill.cadence,
        dueOn,
        amount: Number(bill.amount) || 0,
        currency: (bill.currency ?? "USD").toUpperCase(),
        amountUsd,
        status,
        // 到期日已到（含今天）且尚未点过确认逾期，可标记；已入账也可点以取消该期入账
        canMarkOverdue: !userMarkedOverdue && dueOn <= today,
      });
    }
  }

  occurrences.sort((a, b) => {
    if (a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1;
    return a.category.localeCompare(b.category);
  });

  let expensePlannedUsd = 0;
  let expensePostedUsd = 0;
  let expensePendingUsd = 0;
  let expenseOverdueUsd = 0;
  let expenseMarkedOverdueUsd = 0;
  let incomePlannedUsd = 0;
  let incomePostedUsd = 0;

  for (const o of occurrences) {
    if (o.type === "expense") {
      expensePlannedUsd += o.amountUsd;
      if (o.status === "posted") expensePostedUsd += o.amountUsd;
      else if (o.status === "markedOverdue") expenseMarkedOverdueUsd += o.amountUsd;
      else {
        expensePendingUsd += o.amountUsd;
        if (o.status === "overdue") expenseOverdueUsd += o.amountUsd;
      }
    } else {
      incomePlannedUsd += o.amountUsd;
      if (o.status === "posted") incomePostedUsd += o.amountUsd;
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    year: params.year,
    month: params.month,
    monthLabel,
    expensePlannedUsd: round2(expensePlannedUsd),
    expensePostedUsd: round2(expensePostedUsd),
    expensePendingUsd: round2(expensePendingUsd),
    expenseOverdueUsd: round2(expenseOverdueUsd),
    expenseMarkedOverdueUsd: round2(expenseMarkedOverdueUsd),
    incomePlannedUsd: round2(incomePlannedUsd),
    incomePostedUsd: round2(incomePostedUsd),
    occurrences,
  };
}
