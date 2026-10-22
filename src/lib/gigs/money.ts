import type { GigInstallment, GigProject, GigVertical } from "@/lib/gigs/types";

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

export function timeUnitForVertical(vertical: GigVertical): "hours" | "sessions" {
  return vertical === "training" ? "sessions" : "hours";
}

export function projectTimeQuantity(project: GigProject): number {
  return round2((project.timeLogs ?? []).reduce((s, entry) => s + (Number(entry.quantity) || 0), 0));
}

export function formatTimeQuantity(quantity: number): string {
  const rounded = round2(quantity);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/** 已收 − 项目成本。工时不参与利润。 */
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
  lastNudgedOn?: string;
  nextNudgeOn?: string;
};

export function isIsoDate(value: string | undefined | null): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function addIsoDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 下次再催日期已到（含今天） */
export function isChaseDue(nextNudgeOn: string | undefined, today: string): boolean {
  return Boolean(nextNudgeOn && nextNudgeOn <= today);
}

export function nudgeInstallment(
  project: GigProject,
  installmentId: string,
  nextOn: string,
  today: string,
): GigProject {
  const nextNudgeOn = isIsoDate(nextOn) ? nextOn : addIsoDays(today, 7);
  return {
    ...project,
    installments: project.installments.map((inst) =>
      inst.id === installmentId ? { ...inst, lastNudgedOn: today, nextNudgeOn } : inst,
    ),
  };
}

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
        lastNudgedOn: inst.lastNudgedOn,
        nextNudgeOn: inst.nextNudgeOn,
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

export type ClientCurrencyTotals = {
  currency: string;
  received: number;
  receivable: number;
};

/** 该客户名下未取消项目的累计已收与还欠，按项目币种分开 */
export function clientCurrencyTotals(projects: GigProject[], clientId: string): ClientCurrencyTotals[] {
  const map = new Map<string, { received: number; receivable: number }>();
  for (const project of projects) {
    if (project.clientId !== clientId || project.status === "cancelled") continue;
    const prev = map.get(project.currency) ?? { received: 0, receivable: 0 };
    prev.received = round2(prev.received + projectReceivedTotal(project));
    prev.receivable = round2(prev.receivable + projectReceivableTotal(project));
    map.set(project.currency, prev);
  }
  return [...map.entries()].map(([currency, totals]) => ({ currency, ...totals }));
}

export function sumUnpaidByCurrency(rows: UnpaidRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.currency, round2((map.get(r.currency) ?? 0) + r.outstanding));
  }
  return map;
}
