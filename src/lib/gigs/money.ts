import type { GigInstallment, GigProject } from "@/lib/gigs/types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 该期还差多少未收 */
export function installmentOutstanding(inst: GigInstallment): number {
  if (inst.status === "paid") return 0;
  const paid = Math.max(0, Number(inst.paidAmount) || 0);
  const amount = Math.max(0, Number(inst.amount) || 0);
  return round2(Math.max(0, amount - paid));
}

export function installmentReceived(inst: GigInstallment): number {
  if (inst.status === "paid") return round2(Math.max(0, Number(inst.amount) || 0));
  return round2(Math.max(0, Number(inst.paidAmount) || 0));
}

export function projectContractTotal(project: GigProject): number {
  return round2(project.installments.reduce((s, i) => s + (Number(i.amount) || 0), 0));
}

export function projectReceivedTotal(project: GigProject): number {
  return round2(project.installments.reduce((s, i) => s + installmentReceived(i), 0));
}

export function projectReceivableTotal(project: GigProject): number {
  return round2(project.installments.reduce((s, i) => s + installmentOutstanding(i), 0));
}

export function projectCostTotal(project: GigProject): number {
  return round2(project.costs.reduce((s, c) => s + (Number(c.amount) || 0), 0));
}

/** 已收 − 成本（项目币种；未换汇） */
export function projectProfit(project: GigProject): number {
  return round2(projectReceivedTotal(project) - projectCostTotal(project));
}

export type UnpaidRow = {
  projectId: string;
  projectName: string;
  clientId: string;
  installmentId: string;
  label: string;
  outstanding: number;
  currency: string;
  dueOn?: string;
  status: GigInstallment["status"];
};

export function collectUnpaid(projects: GigProject[]): UnpaidRow[] {
  const rows: UnpaidRow[] = [];
  for (const p of projects) {
    if (p.status === "cancelled") continue;
    for (const inst of p.installments) {
      const outstanding = installmentOutstanding(inst);
      if (outstanding <= 0) continue;
      rows.push({
        projectId: p.id,
        projectName: p.name,
        clientId: p.clientId,
        installmentId: inst.id,
        label: inst.label,
        outstanding,
        currency: p.currency,
        dueOn: inst.dueOn,
        status: inst.status,
      });
    }
  }
  rows.sort((a, b) => {
    const ad = a.dueOn || "9999-99-99";
    const bd = b.dueOn || "9999-99-99";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return b.outstanding - a.outstanding;
  });
  return rows;
}

export type AgingBucket = "notDue" | "d0_30" | "d31_60" | "d60plus" | "noDue";

export function agingBucket(dueOn: string | undefined, today: string): AgingBucket {
  if (!dueOn) return "noDue";
  if (dueOn >= today) return "notDue";
  const due = new Date(`${dueOn}T12:00:00`);
  const now = new Date(`${today}T12:00:00`);
  const days = Math.floor((now.getTime() - due.getTime()) / 86400000);
  if (days <= 30) return "d0_30";
  if (days <= 60) return "d31_60";
  return "d60plus";
}

export function sumUnpaidByCurrency(rows: UnpaidRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.currency, round2((map.get(r.currency) ?? 0) + r.outstanding));
  }
  return map;
}
