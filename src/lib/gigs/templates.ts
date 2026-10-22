import type { GigInstallment, GigVertical } from "@/lib/gigs/types";
import { newGigId } from "@/lib/gigs/types";

/** 业态默认分期标签（金额由用户填） */
export function defaultInstallmentsForVertical(vertical: GigVertical): Omit<GigInstallment, "amount">[] {
  const base = (label: string): Omit<GigInstallment, "amount"> => ({
    id: newGigId(),
    label,
    status: "pending",
    paidAmount: 0,
  });

  switch (vertical) {
    case "design":
      return [base("定金 30%"), base("中期款"), base("尾款")];
    case "development":
      return [base("启动款"), base("里程碑 1"), base("里程碑 2"), base("验收尾款")];
    case "training":
      return [base("课时包全款")];
    case "consulting":
      return [base("首期"), base("尾款")];
    default:
      return [base("全款")];
  }
}

export function makeInstallmentsFromTemplate(
  vertical: GigVertical,
  totalAmount: number,
): GigInstallment[] {
  const stubs = defaultInstallmentsForVertical(vertical);
  const total = Math.max(0, Number(totalAmount) || 0);
  if (stubs.length === 1) {
    return [{ ...stubs[0]!, amount: total }];
  }
  if (vertical === "design" && stubs.length === 3) {
    const a = round2(total * 0.3);
    const b = round2(total * 0.4);
    const c = round2(total - a - b);
    return [
      { ...stubs[0]!, amount: a },
      { ...stubs[1]!, amount: b },
      { ...stubs[2]!, amount: c },
    ];
  }
  const each = stubs.length ? round2(total / stubs.length) : 0;
  return stubs.map((s, i) => ({
    ...s,
    amount: i === stubs.length - 1 ? round2(total - each * (stubs.length - 1)) : each,
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
