import type { RecurringBillRow } from "@/lib/recurring-bills";
import { amountTowardUsd, calendarDueDatesInMonth } from "@/lib/recurring-bills";

export type FixedCostStatus = "posted" | "overdue" | "dueToday" | "upcoming";

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
};

export type FixedCostBoard = {
  year: number;
  month: number;
  monthLabel: string;
  /** 本月支出计划（USD） */
  expensePlannedUsd: number;
  /** 本月支出已入账（USD） */
  expensePostedUsd: number;
  /** 本月支出待入账（已到期未入账 + 未到期）（USD） */
  expensePendingUsd: number;
  expenseOverdueUsd: number;
  incomePlannedUsd: number;
  incomePostedUsd: number;
  occurrences: FixedCostOccurrence[];
};

function statusFor(dueOn: string, lastGeneratedOn: string | null, today: string): FixedCostStatus {
  const posted = Boolean(lastGeneratedOn && lastGeneratedOn >= dueOn);
  if (posted) return "posted";
  if (dueOn < today) return "overdue";
  if (dueOn === today) return "dueToday";
  return "upcoming";
}

/** 由周期账单规则生成本月固定开销看板（须先 materialize 再算更准） */
export function buildFixedCostBoard(params: {
  bills: RecurringBillRow[];
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
        status: statusFor(dueOn, bill.last_generated_on, today),
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
  let incomePlannedUsd = 0;
  let incomePostedUsd = 0;

  for (const o of occurrences) {
    if (o.type === "expense") {
      expensePlannedUsd += o.amountUsd;
      if (o.status === "posted") expensePostedUsd += o.amountUsd;
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
    incomePlannedUsd: round2(incomePlannedUsd),
    incomePostedUsd: round2(incomePostedUsd),
    occurrences,
  };
}
